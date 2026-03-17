import { Readable } from 'stream'
import { formatDocumentsAsString } from "langchain/util/document"
import { PromptTemplate } from "@langchain/core/prompts"
import { RunnableSequence } from "@langchain/core/runnables"
// import { CohereRerank } from "@langchain/cohere"
import { CohereRerank } from "@/server/rerank/cohere"
import { setEventStreamResponse } from '@/server/utils'
import { BaseRetriever } from "@langchain/core/retrievers"
import prisma from "@/server/utils/prisma"
import { createChatModel, createEmbeddings } from '@/server/utils/models'
import { createRetriever } from '@/server/retriever'
import { AIMessage, BaseMessage, BaseMessageLike, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { resolveCoreference } from '~/server/coref'
import { concat } from "@langchain/core/utils/stream"
import { MODEL_FAMILIES } from '~/config'
import { McpService } from '@/server/utils/mcp'
import { codeExecutionTools } from '@/server/utils/codeExecution'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { transformImageContent } from '@/server/utils/transformImageContent'

interface RequestBody {
    knowledgebaseId: number
    model: string
    family: string
    messages: {
        role: 'system' | 'user' | 'assistant'
        content: string
        toolCallId?: string
        toolResult: boolean
    }[]
    stream: any
    codeAgentEnabled?: boolean
}

const SYSTEM_TEMPLATE = `Answer the user's question based on the context below.
Present your answer in a structured Markdown format.

If the context doesn't contain any relevant information to the question, don't make something up and just say "I don't know":

<context>
{context}
</context>

<chat_history>
{chatHistory}
</chat_history>

<question>
{question}
</question>

Answer:
`

const serializeMessages = (messages: RequestBody['messages']): string =>
    messages.slice(0, -1).map((message) => `${message.role}: ${message.content}`).join("\n")

const transformMessages = (messages: RequestBody['messages']): BaseMessageLike[] =>
    messages.map((message) => {
        if (message.role === 'system') {
            return [message.role, message.content] as [string, string]
        }
        return [message.role, message.content]
    })

const normalizeMessages = (messages: RequestBody['messages']): BaseMessage[] => {
    const normalizedMessages = []
    for (const message of messages) {
        if (message.toolResult) {
            normalizedMessages.push(new ToolMessage(message.content, message.toolCallId!))
        } else if (message.role === "user") {
            normalizedMessages.push(new HumanMessage(message.content))
        } else if (message.role === "assistant") {
            normalizedMessages.push(new AIMessage(message.content))
        }
    }

    return normalizedMessages
}

export default defineEventHandler(async (event) => {
    try {
        const { knowledgebaseId, model, family, messages, stream, codeAgentEnabled } = await readBody<RequestBody>(event)

        console.log("model family stream", model, family, stream)
        console.log("codeAgentEnabled:", codeAgentEnabled)
        if (knowledgebaseId) {
            console.log("Chat with knowledge base with id: ", knowledgebaseId)
            const knowledgebase = await prisma.knowledgeBase.findUnique({
                where: {
                    id: knowledgebaseId,
                },
            })
            console.log(`Knowledge base ${knowledgebase?.name} with embedding "${knowledgebase?.embedding}"`)
            if (!knowledgebase) {
                setResponseStatus(event, 404, `Knowledge base with id ${knowledgebaseId} not found`)
                return
            }

            const embeddings = createEmbeddings(knowledgebase.embedding!, event)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const retriever: any = await createRetriever(embeddings, `collection_${knowledgebase.id}`)

            const chat = createChatModel(model, family, event)
            const query = messages[messages.length - 1].content
            console.log("User query: ", query)

            // const reformulatedResult = await resolveCoreference(query, normalizeMessages(messages), chat);
            const reformulatedQuery = query
            console.log("Reformulated query: ", reformulatedQuery)

            const relevant_docs = await retriever.invoke(reformulatedQuery)
            console.log("Relevant documents: ", relevant_docs)

            let rerankedDocuments = relevant_docs

            if ((process.env.COHERE_API_KEY || process.env.COHERE_BASE_URL) && process.env.COHERE_MODEL) {
                const options = {
                    apiKey: process.env.COHERE_API_KEY,
                    baseUrl: process.env.COHERE_BASE_URL,
                    model: process.env.COHERE_MODEL,
                    topN: 4,
                }
                console.log("Cohere Rerank Options: ", options)
                const cohereRerank = new CohereRerank(options)
                rerankedDocuments = await cohereRerank.compressDocuments(relevant_docs, reformulatedQuery)
                console.log("Cohere reranked documents: ", rerankedDocuments)
            }

            const chain = RunnableSequence.from([
                {
                    question: (input: { question: string; chatHistory?: string }) => input.question,
                    chatHistory: (input: { question: string; chatHistory?: string }) => input.chatHistory ?? "",
                    context: async () => {
                        return formatDocumentsAsString(rerankedDocuments)
                    },
                },
                PromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
                chat,
            ])

            if (!stream) {
                const response = await chain.invoke({
                    question: query,
                    chatHistory: serializeMessages(messages),
                })

                return {
                    message: {
                        role: 'assistant',
                        content: response?.content,
                        relevant_docs,
                    },
                }
            }

            setEventStreamResponse(event)
            const response = await chain.stream({
                question: query,
                chatHistory: serializeMessages(messages),
            })

            const readableStream = Readable.from(
                (async function* () {
                    for await (const chunk of response) {
                        if (chunk?.content !== undefined) {
                            const message = {
                                message: {
                                    role: 'assistant',
                                    content: chunk?.content,
                                },
                            }
                            yield `${JSON.stringify(message)} \n\n`
                        }
                    }

                    const docsChunk = {
                        type: 'relevant_documents',
                        relevant_documents: rerankedDocuments,
                    }
                    yield `${JSON.stringify(docsChunk)} \n\n`
                })()
            )
            return sendStream(event, readableStream)
        } else {
            let llm = createChatModel(model, family, event)

            const mcpService = new McpService()
            const normalizedTools = await mcpService.listTools()
            
            // Combine MCP tools with code execution tools (only if enabled)
            const toolsToUse = codeAgentEnabled ? [...codeExecutionTools, ...normalizedTools] : normalizedTools
            const toolsMap = toolsToUse.reduce((acc, t) => {
                acc[t.name] = t
                return acc
            }, {})

            // Bind tools and use Agent for multi-round execution
            // Inject system prompt for code agent mode
            let finalMessages = messages
            if (codeAgentEnabled && toolsToUse.length > 0) {
                const toolDescriptions = toolsToUse.map(t => t.name + ': ' + t.description).join(', ')
                const codeAgentSystemPrompt = `You have access to tools. When a task requires computation, data processing, or code execution:
1. Use the available tools to accomplish the task step by step
2. If a tool execution succeeds, check if the task is complete
3. If not complete, continue with additional tool calls or provide your final answer
4. Only respond with the final result after all necessary executions are done

IMPORTANT for plotting/graphics:
- Do NOT use plt.show() as it blocks until the window is closed, causing timeouts
- Instead, save plots directly using plt.savefig('filename.png')
- matplotlib will display the saved file automatically

IMPORTANT for JavaScript:
- You cannot install npm packages in this environment
- Use only built-in Node.js modules (math, console, etc.)
- For graphics, Python/matplotlib is recommended

Available tools: ${toolDescriptions}`

                finalMessages = [
                    { role: 'system', content: codeAgentSystemPrompt, toolCallId: '', toolResult: false },
                    ...messages
                ]
            }

            console.log('[CodeAgent] Final messages count:', finalMessages.length)
            
            if (family === MODEL_FAMILIES.anthropic && toolsToUse?.length) {
                if (llm?.bindTools) {
                    llm = llm.bindTools(toolsToUse) as BaseChatModel
                    console.log('[CodeAgent] Bound tools to Anthropic model')
                }
            } else if (llm instanceof ChatOllama) {
                // Ollama with tools - handled separately if needed
            } else if (normalizedTools?.length || (codeAgentEnabled && codeExecutionTools.length)) {
                // For other models that support function calling
                if (llm?.bindTools) {
                    llm = llm.bindTools(toolsToUse) as BaseChatModel
                    console.log('[CodeAgent] Bound tools via bindTools for:', family)
                }
            }

            if (!stream) {
                const response = await llm.invoke(transformMessages(finalMessages))
                console.log("from non-stream:", response)
                return {
                    message: {
                        role: 'assistant',
                        content: response?.content,
                    },
                }
            }

            const response = await llm?.stream(
                finalMessages.map((message: RequestBody['messages'][number]) => {
                    let content: string | any[] = message.content

                    // Check if message.content is an array (contains text and/or image)
                    if (Array.isArray(message.content)) {
                        console.log("Transforming image content for family:", family)
                        try {
                            content = transformImageContent(message.content, family)
                        } catch (error) {
                            console.log("Error parsing array content:", message.content, error)
                        }
                    }
                    return [message.role, content]
                })
            )

            console.log(response)

            const readableStream = Readable.from(
                (async function* () {
                    let gathered = undefined

                    for await (const chunk of response) {
                        gathered = gathered !== undefined ? concat(gathered, chunk) : chunk

                        let content = chunk?.content

                        // Handle array of text_delta objects
                        if (Array.isArray(content)) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            content = content
                                .filter((item: any) => item.type === 'text_delta')
                                .map((item: any) => item.text)
                                .join('')
                        }

                        const message = {
                            message: {
                                role: 'assistant',
                                content: content,
                            },
                        }
                        yield `${JSON.stringify(message)} \n\n`
                    }

                    // Handle tool calls - execute and return results
                    const toolCalls = gathered?.tool_calls ?? []
                    if (toolCalls.length > 0) {
                        console.log(`[CodeAgent] Executing ${toolCalls.length} tool call(s)`)
                    }

                    for (const toolCall of toolCalls) {
                        console.log('Tool call: ', toolCall)
                        const selectedTool = toolsMap[toolCall.name]

                        if (selectedTool) {
                            const result = await selectedTool.invoke(toolCall)
                            console.log('Tool result: ', result)

                            const message = {
                                message: {
                                    role: 'user',
                                    type: 'tool_result',
                                    tool_use_id: result.tool_call_id,
                                    content: result.content,
                                },
                            }

                            yield `${JSON.stringify(message)} \n\n`
                        }
                    }
                })()
            )

            return sendStream(event, readableStream)
        }
    } catch (err) {
        console.error('Error in event handler:', err) // Log the error for debugging
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            data: {
                message: 'Something went wrong on the server.',
            },
        })
    }
})
