import { Readable } from 'stream'
import { formatDocumentsAsString } from "@langchain/classic/util/document"
import { PromptTemplate } from "@langchain/core/prompts"
import { RunnableSequence } from "@langchain/core/runnables"
// import { CohereRerank } from "@langchain/cohere"
import { CohereRerank } from "@/server/rerank/cohere"
import { setEventStreamResponse } from '@/server/utils'
import { BaseRetriever } from "@langchain/core/retrievers"
import prisma from "@/server/utils/prisma"
import { createChatModel, createEmbeddings } from '@/server/utils/models'
import { createRetriever } from '@/server/retriever'
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessageLike } from '@langchain/core/messages'
import { resolveCoreference } from '~/server/coref'
import { concat } from "@langchain/core/utils/stream"
import { MODEL_FAMILIES } from '~/config'
import { McpService } from '@/server/utils/mcp'
import { svgTools } from '@/server/utils/svgTool'
import { imageTools, setImageToolKeys } from '@/server/utils/imageTool'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ChatOllama } from '@langchain/ollama'
import { tool } from '@langchain/core/tools'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { transformImageContent } from '@/server/utils/transformImageContent'
import type { ContextKeys } from '~/server/middleware/keys'
import type { H3Event } from 'h3'
import { skillLoader, setSkillConfigs } from '@/server/skills'

function isUsageLimitError(error: any): boolean {
    const errorStr = String(error?.message || error || '')
    const statusCode = error?.status_code || error?.base_resp?.status_code
    console.log('[isUsageLimitError] Checking error:', { errorStr, statusCode, full: error })
    return statusCode === 2063 || 
           statusCode === 2056 ||
           statusCode === 1008 ||
           errorStr.includes('token plan only supports') || 
           errorStr.includes('usage limit exceeded') ||
           errorStr.includes('insufficient balance')
}

function createChatModelWithFallback(model: string, family: string, event: H3Event): BaseChatModel {
    const keys = event.context.keys
    const familyValue = Object.entries(MODEL_FAMILIES).find(([key, val]) => val === family)?.[0]
    
    if (!familyValue || familyValue !== 'minimax') {
        return createChatModel(model, family, event)
    }

    const minimaxKeys = keys.minimax as ContextKeys['minimax']
    const primaryEndpoint = minimaxKeys?.endpoint || 'https://api.minimax.chat/v1'

    try {
        return createChatModel(model, family, event)
    } catch (error: any) {
        if (!minimaxKeys?.secondary?.key || !isUsageLimitError(error)) {
            throw error
        }
        
        console.log('[createChatModelWithFallback] Primary API usage limit reached, switching to secondary API')
        
        const secondaryData = {
            ...minimaxKeys,
            key: minimaxKeys.secondary.key,
            endpoint: minimaxKeys.secondary.endpoint || primaryEndpoint
        }
        
        event.context.keys = {
            ...keys,
            minimax: secondaryData
        }
        
        return createChatModel(model, family, event)
    }
}

function switchToSecondaryKeys(event: H3Event, family: string): boolean {
    if (family !== MODEL_FAMILIES.minimax) return false
    
    const keys = event.context.keys
    const minimaxKeys = keys.minimax as ContextKeys['minimax']
    
    if (!minimaxKeys?.secondary?.key) return false
    
    const primaryEndpoint = minimaxKeys?.endpoint || 'https://api.minimax.chat/v1'
    const secondaryData = {
        ...minimaxKeys,
        key: minimaxKeys.secondary.key,
        endpoint: minimaxKeys.secondary.endpoint || primaryEndpoint
    }
    
    event.context.keys = {
        ...keys,
        minimax: secondaryData
    }
    
    console.log('[switchToSecondaryKeys] Switched to secondary MiniMax API')
    return true
}

interface RequestBody {
    knowledgebaseId?: string
    model: string
    family?: string
    messages: {
        role: 'system' | 'user' | 'assistant'
        content: string
        toolCallId?: string
        toolResult: boolean
    }[]
    stream: any
    skills?: string[]
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
        const { knowledgebaseId, model, family, messages, stream, skills } = await readBody<RequestBody>(event)

        console.log("model family stream", model, family, stream)
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
            let llm = createChatModelWithFallback(model, family, event)

            const mcpService = new McpService()

            // Load skill tools and system prompts only if needed
            let skillTools: any[] = []
            let skillSystemPrompt = ''
            const effectiveSkills = skills || []
            
            console.log('[Chat] effectiveSkills:', effectiveSkills)
            
            if (effectiveSkills?.length) {
                await skillLoader.loadAll(true)
                skillTools = skillLoader.getAllTools(effectiveSkills)
                skillSystemPrompt = skillLoader.getSystemPrompt(effectiveSkills)
                
                console.log('[Chat] Loaded tools for skills:', effectiveSkills, 'tool count:', skillTools.length)
                console.log('[Chat] Tool names:', skillTools.map(t => t.name))
                
                if (event.context.skillConfigs) {
                    setSkillConfigs(event.context.skillConfigs)
                }
            }

            // Load tools based on selected skills only
            const mcpSkills = ['pptx-maker']
            const selectedMcpSkills = effectiveSkills?.length 
                ? effectiveSkills.filter(s => mcpSkills.includes(s)) 
                : []
            const normalizedTools = selectedMcpSkills.length > 0 ? await mcpService.listTools() : []

            // Combine tools - only selected skills get their tools
            const hasCodeRunner = effectiveSkills?.includes('code-runner')
            const hasWebResearcher = effectiveSkills?.includes('web-researcher')
            const toolsToUse = effectiveSkills?.length
                ? [...(hasCodeRunner ? svgTools : []), ...(hasCodeRunner ? imageTools : []), ...normalizedTools, ...skillTools]
                : []
            
            console.log('[Chat] Selected skills:', effectiveSkills)
            console.log('[Chat] MCP tools loaded for:', selectedMcpSkills, 'count:', normalizedTools.length)
            console.log('[Chat] Skill tools loaded:', skillTools.map(t => t.name))
            console.log('[Chat] Total tools for model:', toolsToUse.map(t => t.name))
            const toolsMap = toolsToUse.reduce((acc, t) => {
                acc[t.name] = t
                return acc
            }, {})

            // Bind tools and use Agent for multi-round execution
            // Inject system prompt for code agent mode
            let finalMessages = messages
            if (toolsToUse.length > 0) {
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
            } else if (skillSystemPrompt) {
                // Inject skill system prompts
                const systemMessages = messages.filter(m => m.role === 'system')
                const nonSystemMessages = messages.filter(m => m.role !== 'system')

                const combinedSystemPrompt = skillSystemPrompt

                finalMessages = [
                    { role: 'system', content: combinedSystemPrompt, toolCallId: '', toolResult: false },
                    ...systemMessages,
                    ...nonSystemMessages
                ]
            }

            console.log('[Skills] Final messages count:', finalMessages.length)
            console.log('[Skills] Loaded skills:', skills, 'with', skillTools.length, 'tools')
            console.log('[Skills] toolsToUse:', toolsToUse.map(t => t.name))

            if (family === MODEL_FAMILIES.anthropic && toolsToUse?.length) {
                if (llm?.bindTools) {
                    llm = llm.bindTools(toolsToUse) as BaseChatModel
                    console.log('[Skills] Bound tools to Anthropic model')
                }
            } else if (llm instanceof ChatOllama) {
                // Ollama with tools - handled separately if needed
            } else if (toolsToUse.length > 0) {
                // For other models that support function calling
                if (llm?.bindTools) {
                    llm = llm.bindTools(toolsToUse) as BaseChatModel
                    console.log('[Skills] Bound tools via bindTools for:', family)
                }
            }

            // Retry logic for MiniMax usage limit
            let lastError: any = null
            let usedSecondary = false
            
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
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

                    // Streaming with continuous tool calls
                    try {
                        console.log('[Chat] Starting stream for model:', family, 'with', toolsToUse.length, 'tools')

                        const readableStream = Readable.from(
                            (async function* () {
                                let iteration = 0
                                const maxIterations = 10
                                let currentMessages = [...finalMessages]
                                let shouldContinue = true
                                let finalContent: string = ''  // Track content from last iteration
                                
                                while (shouldContinue && iteration < maxIterations) {
                                    iteration++
                                    console.log(`[Chat] Iteration ${iteration}, messages count:`, currentMessages.length)
                                    
                                    // Initialize assistantContent for this iteration
                                    let assistantContent: string = ''
                                    
                                    const transformedMessages = currentMessages.map((message: RequestBody['messages'][number]) => {
                                        let content: string | any[] = message.content
                                        if (Array.isArray(message.content)) {
                                            try {
                                                content = transformImageContent(message.content, family)
                                            } catch (error) {
                                                console.log("Error parsing array content:", message.content, error)
                                            }
                                        }
                                        return [message.role, content]
                                    })

                                    const response = await Promise.race([
                                        llm.stream(transformedMessages),
                                        new Promise((_, reject) => 
                                            setTimeout(() => reject(new Error('Stream timeout after 180 seconds')), 180000)
                                        )
                                    ])

                                    console.log('[Chat] Stream response received, iteration:', iteration)

                                    let gathered: any = null
                                    
                                    // Accumulate all chunks first
                                    for await (const chunk of response) {
                                        gathered = gathered ? concat(gathered, chunk) : chunk
                                        let content = chunk?.content
                                        if (Array.isArray(content)) {
                                            content = content
                                                .filter((item: any) => item.type === 'text_delta')
                                                .map((item: any) => item.text)
                                                .join('')
                                        }
                                        assistantContent = (assistantContent || '') + (content || '')
                                    }

                                    // Only yield the COMPLETE assistant message after all chunks
                                    const toolCalls = gathered?.tool_calls ?? []
                                    
                                    // Ensure assistantContent is always a string
                                    finalContent = String(assistantContent || '')
                                    
                                    console.log('[Chat] Assistant content:', finalContent.substring(0, 100), 'toolCalls:', toolCalls.length)
                                    
                                    // Include tool call info if there are tool calls
                                    const completeMessage = {
                                        message: {
                                            role: 'assistant',
                                            content: finalContent,
                                            toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ name: tc.name, args: tc.args })) : undefined,
                                        },
                                    }
                                    yield `${JSON.stringify(completeMessage)} \n\n`

                                    // If no tool calls, we're done - loop will exit after this
                                    if (!toolCalls || toolCalls.length === 0) {
                                        console.log('[Chat] No more tool calls, ending loop')
                                        shouldContinue = false
                                        // Don't break yet - let the loop naturally end so we get a proper exit
                                        break
                                    }

                                    console.log(`[Chat] Executing ${toolCalls.length} tool call(s):`, toolCalls.map(tc => tc.name))
                                    const keys = event.context.keys
                                    if (keys?.minimax) {
                                        setImageToolKeys(keys.minimax.key, keys.minimax.endpoint, keys.minimax.secondary)
                                    }

                                    // Execute tool calls and collect results
                                    const toolResults: Array<{name: string, content: string, toolCallId: string, args: any}> = []
                                    
                                    for (const toolCall of toolCalls) {
                                        console.log('Tool call: ', toolCall)
                                        const selectedTool = toolsMap[toolCall.name]
                                        if (selectedTool) {
                                            const result = await selectedTool.invoke(toolCall)
                                            toolResults.push({
                                                name: toolCall.name,
                                                content: result.content,
                                                toolCallId: result.tool_call_id,
                                                args: toolCall.args,
                                            })
                                            
                                            // Yield tool result message
                                            const toolMessage = {
                                                message: {
                                                    role: 'user',
                                                    toolResult: true,
                                                    toolCallId: result.tool_call_id,
                                                    toolName: toolCall.name,
                                                    toolInput: toolCall.args,
                                                    toolOutput: result.content,
                                                    content: result.content,
                                                },
                                            }
                                            yield `${JSON.stringify(toolMessage)} \n\n`
                                        }
                                    }

                                    // Add assistant message and tool results to continue conversation
                                    currentMessages = [
                                        ...currentMessages,
                                        { role: 'assistant', content: finalContent },
                                        ...toolResults.map(tr => ({
                                            role: 'user',
                                            toolResult: true,
                                            toolCallId: tr.toolCallId,
                                            toolName: tr.name,
                                            toolInput: tr.args,
                                            toolOutput: tr.content,
                                            content: tr.content,
                                        })),
                                    ]
                                    
                                    console.log(`[Chat] Added ${toolResults.length} tool results, continuing with ${currentMessages.length} messages`)
                                }
                                
                                if (iteration >= maxIterations) {
                                    console.log('[Chat] Reached max iterations, ending loop')
                                }
                                
                                if (!shouldContinue) {
                                    // Use finalContent which was set in the last iteration
                                    const contentForLog = typeof finalContent !== 'undefined' 
                                        ? finalContent.substring(0, 200) 
                                        : '(no content)'
                                    console.log('[Chat] EXITING LOOP - iteration:', iteration, 'content:', contentForLog)
                                    // Send a completion signal by yielding a special message
                                    yield `${JSON.stringify({ type: 'flow_complete' })} \n\n`
                                }
                            })()
                        )
                        return sendStream(event, readableStream)
                    } catch (e: any) {
                        console.log('[Chat] Stream error:', e.message, e.stack)
                        // Send error event
                        throw e
                    }
                } catch (error: any) {
                    lastError = error
                    console.log('[Chat] Error:', error.message)
                    
                    // Only retry for MiniMax usage limit errors
                    if (!isUsageLimitError(error) || family !== MODEL_FAMILIES.minimax) {
                        throw error
                    }
                    
                    // Try secondary API
                    if (!usedSecondary && switchToSecondaryKeys(event, family)) {
                        console.log('[Chat] Retrying with secondary API...')
                        llm = createChatModel(model, family, event)
                        usedSecondary = true
                        continue
                    }
                    
                    throw error
                }
            }
            
            throw lastError
        }
    } catch (err: any) {
        console.error('Error in event handler:', err) // Log the error for debugging
        console.error('Error details:', { 
            message: err?.message, 
            status_code: err?.status_code,
            base_resp: err?.base_resp 
        })
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            data: {
                message: 'Something went wrong on the server.',
            },
        })
    }
})
