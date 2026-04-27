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
import { wikiService } from '@/server/services/wiki'

// Handle confirm tool - returns confirmation prompt for UI to display
async function handleConfirmTool(toolCall: any, toolArgs: any, sessionId: number) {
  const { message, action, details } = toolArgs
  const toolCallId = toolCall.id || `call_${Date.now()}`
  const confirmId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Store confirm request in global for polling
  const confirmRequests = (global as any).confirmRequests || new Map()
  confirmRequests.set(confirmId, {
    sessionId,
    action: action || 'Unknown action',
    message: message || 'Please confirm',
    details: details || '',
    response: null,
    createdAt: Date.now()
  })
  ;(global as any).confirmRequests = confirmRequests
  
  // Return the confirmation info - UI will display it
  // The LLM will wait for user response after seeing this
  return {
    content: JSON.stringify({
      success: true,
      confirm: true,
      confirmId,
      action: action || 'Unknown action',
      message: message || 'Please confirm',
      details: details || '',
      awaiting: true,
      prompt: `ACTION: ${action || 'Unknown'}\n${message || 'Please confirm this action'}\n\nClick Confirm to proceed or Deny to cancel.`
    }),
    tool_call_id: toolCallId
  }
}

// Poll for confirm response
async function pollForConfirmResponse(confirmId: string, maxWaitMs: number = 120000): Promise<string | null> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitMs) {
    // Always get fresh reference to global map
    const confirmRequests = (global as any).confirmRequests || new Map()
    const request = confirmRequests.get(confirmId)
    console.log('[pollForConfirmResponse] Checking confirmId:', confirmId, 'request:', request)
    if (request && request.response) {
      confirmRequests.delete(confirmId)
      return request.response
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return null
}

// Handle summarize tool - generates actual summary using the LLM
async function handleSummarizeTool(toolCall: any, currentMessages: any[], llm: any, family: string) {
    const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args
    const { focus, format = 'detailed' } = args
    
    // Build conversation context from messages
    const conversationParts = currentMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role}: ${String(m.content).substring(0, 500)}`)
        .join('\n\n')
    
    const summaryPrompt = format === 'brief'
        ? `Provide a brief summary of the conversation in 2-3 sentences:\n\n${conversationParts}`
        : `Create a comprehensive summary of the conversation with the following sections:

## Goal
What goal(s) is the user trying to accomplish?

## Instructions
What important instructions did the user give?

## Discoveries
What notable things were learned during the conversation?

## Accomplished
What work has been completed?

## Relevant Files/Directories
A structured list of important files and directories mentioned or modified.

## Pending Tasks
What tasks remain to be done?

Conversation:
${conversationParts}

Please fill in each section with relevant details from the conversation above.`

    try {
        // Call LLM to generate summary
        const summaryResponse = await llm.invoke(summaryPrompt)
        const summaryText = typeof summaryResponse === 'string' ? summaryResponse : summaryResponse.content
        
        return {
            content: summaryText,
            tool_call_id: toolCall.id
        }
    } catch (e) {
        console.log('[handleSummarizeTool] Error:', e)
        return {
            content: `Error generating summary: ${e.message}`,
            tool_call_id: toolCall.id
        }
    }
}

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
    sessionId?: number
    userId?: number
    anonymousId?: string
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
    console.log('🔵 ======================================== [CHAT-API-START] ========================================')
    try {
        const body = await readBody(event)
        const { knowledgebaseId, model, family, messages, stream, skills, sessionId, userId, anonymousId } = body

        console.log('🔵 [CHAT-API] body keys:', Object.keys(body))
        console.log('🔵 [CHAT-API] sessionId:', sessionId, 'userId:', userId, 'anonymousId:', anonymousId)
        
        // Save user message to database
        console.log('🔵 [CHAT-API] Checking save - sessionId:', sessionId, 'userId:', userId, 'anonymousId:', anonymousId)
        
        // Try to save user message - use session info if no user info
        if (sessionId) {
            const lastMessage = messages?.filter(m => m.role === 'user').pop()
            console.log('🔵 [CHAT-API] User message:', lastMessage?.content?.substring(0, 50))
            if (lastMessage) {
                const now = Date.now()
                try {
                    await prisma.chatHistory.create({
                        data: {
                            sessionId,
                            userId: userId || null,
                            anonymousId: anonymousId || null,
                            message: lastMessage.content,
                            startTime: BigInt(now),
                            endTime: BigInt(now),
                            model,
                            role: 'user',
                            canceled: false,
                            failed: false,
                            instructionId: null,
                            knowledgeBaseId: knowledgebaseId ? parseInt(knowledgebaseId) : null,
                            toolResult: false
                        }
                    })
                    const existingSession = await prisma.chatSession.findUnique({ where: { id: sessionId }, select: { title: true } })
                    const needsTitle = existingSession?.title === null || existingSession?.title === 'New Chat'
                    console.log('🔵 [CHAT-API] existingSession:', existingSession, 'needsTitle:', needsTitle)
                    const titleUpdate = needsTitle ? { title: lastMessage.content.substring(0, 50) } : {}
                    console.log('🔵 [CHAT-API] Title update:', titleUpdate)
                    
                    await prisma.chatSession.update({
                        where: { id: sessionId },
                        data: {
                            updateTime: BigInt(now),
                            attachedMessagesCount: { increment: 1 },
                            ...titleUpdate
                        }
                    })
                    console.log('🔵 [CHAT-API] User message saved')
                } catch (e) {
                    console.log('🔵 [CHAT-API] Failed to save user message:', e)
                }
            }
        }
        
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
            
            // Helper to strip large base64 data from messages before sending to LLM
            const cleanMessagesForLLM = (msgs: RequestBody['messages']): RequestBody['messages'] => {
                return msgs.map(msg => {
                    if (typeof msg.content === 'string' && msg.content.includes('data:image/png;base64')) {
                        return { ...msg, content: msg.content.substring(0, 100) + '...(image output omitted)' }
                    }
                    return msg
                })
            }
            
            // Clean messages before using them
            const messagesForLLM = cleanMessagesForLLM(messages)
            
            // Inject wiki context if enabled
            let wikiContext = ''
            if (userId) {
                try {
                    const config = await wikiService.getOrCreateConfig(userId)
                    if (config.enabled) {
                        const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
                        if (lastUserMessage) {
                            const relevantPages = await wikiService.searchPages({
                                userId,
                                query: lastUserMessage,
                                limit: 5
                            })
                            if (relevantPages.length > 0) {
                                wikiContext = relevantPages.map(p =>
                                    `[${p.category}] ${p.title}: ${(p.summary || p.content).substring(0, 200)}`
                                ).join('\n')
                                console.log('[Wiki] Injected', relevantPages.length, 'pages')
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Wiki] Error injecting context:', e)
                }
            }
            
            let finalMessages = messagesForLLM
            if (toolsToUse.length > 0) {
                const toolDescriptions = toolsToUse.map(t => t.name + ': ' + t.description).join(', ')
                let systemContent = 'You have access to tools. Use them to accomplish the user\'s task.\nAfter tools execute successfully, provide your final answer to the user. Do NOT call tools repeatedly for the same task.\n\nAvailable tools: ' + toolDescriptions
                if (wikiContext) {
                    systemContent = systemContent + '\n\n## Relevant Context from Previous Sessions\n' + wikiContext + '\n\n---\n'
                }

                finalMessages = [
                    { role: 'system', content: systemContent, toolCallId: '', toolResult: false },
                    ...messagesForLLM
                ]
            } else if (skillSystemPrompt) {
                // Inject skill system prompts
                const systemMessages = messagesForLLM.filter(m => m.role === 'system')
                const nonSystemMessages = messagesForLLM.filter(m => m.role !== 'system')

                let combinedSystemPrompt = skillSystemPrompt
                if (wikiContext) {
                    combinedSystemPrompt = combinedSystemPrompt + '\n\n## Relevant Context from Previous Sessions\n' + wikiContext + '\n\n---\n'
                }

                finalMessages = [
                    { role: 'system', content: combinedSystemPrompt, toolCallId: '', toolResult: false },
                    ...systemMessages,
                    ...nonSystemMessages
                ]
            } else {
                // No tools or skills - just chat with wiki context
                if (wikiContext) {
                    finalMessages = [
                        { role: 'system', content: `## Relevant Context from Previous Sessions\n${wikiContext}\n\n---\n\nYou have context from previous sessions that may be helpful. Use it when relevant.`, toolCallId: '', toolResult: false },
                        ...messagesForLLM
                    ]
                }
            }

            console.log('[Skills] Final messages count:', messagesForLLM.length)
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
                                    
                                    // Clean currentMessages to remove base64 before sending to LLM
                                    currentMessages = currentMessages.map(msg => {
                                        if (typeof msg.content === 'string' && msg.content.includes('data:image/png;base64')) {
                                            return { ...msg, content: msg.content.substring(0, 100) + '...(image omitted)' }
                                        }
                                        return msg
                                    })
                                    
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

                                    // Execute tool calls and collect results
                                    const toolResults: Array<{name: string, content: string, toolCallId: string, args: any}> = []
                                    
for (const toolCall of toolCalls) {
                                        console.log('Tool call: ', toolCall)
                                        const selectedTool = toolsMap[toolCall.name]
                                        
                                        // Convert toolCall args if it's a string
                                            const argsStr = typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args)
                                            const toolArgs = argsStr ? JSON.parse(argsStr) : {}
                                            
                                            // Special handling for confirm tool - wait for user response
                                            if (toolCall.name === 'confirm') {
                                                const handleResult = await handleConfirmTool(toolCall, toolArgs, sessionId)
                                                toolResults.push({
                                                    name: toolCall.name,
                                                    content: handleResult.content,
                                                    toolCallId: handleResult.tool_call_id,
                                                    args: toolArgs,
                                                })
                                            
                                                const toolMessage = {
                                                    message: {
                                                        role: 'user',
                                                        toolResult: true,
                                                        toolCallId: handleResult.tool_call_id,
                                                        toolName: toolCall.name,
                                                        toolInput: toolArgs,
                                                        toolOutput: handleResult.content,
                                                        content: handleResult.content,
                                                    },
                                                }
                                                yield `${JSON.stringify(toolMessage)} \n\n`
                                            
                                                // Extract confirmId from the result
                                                let confirmId = null
                                                try {
                                                    const resultObj = JSON.parse(handleResult.content)
                                                    confirmId = resultObj.confirmId
                                                } catch (e) {
                                                    console.log('[Chat] Error parsing confirm result:', e)
                                                }
                                            
                                                if (confirmId) {
                                                    console.log('[Chat] Polling for confirm response:', confirmId)
                                                    const response = await pollForConfirmResponse(confirmId, 120000)
                                            
                                                    if (response === 'confirmed') {
                                                        console.log('[Chat] User confirmed, continuing...')
                                                        // Update tool result to show confirmation
                                                        const confirmedContent = JSON.stringify({
                                                            success: true,
                                                            confirm: true,
                                                            confirmed: true,
                                                            message: 'User confirmed the action',
                                                            prompt: 'The user has confirmed this action. You may now proceed with the action, or respond to the user that confirmation was received.'
                                                        })
                                                        // Yield confirmation result to client
                                                        const confirmationMessage = {
                                                            message: {
                                                                role: 'user',
                                                                toolResult: true,
                                                                toolCallId: handleResult.tool_call_id,
                                                                toolName: toolCall.name,
                                                                toolInput: toolArgs,
                                                                toolOutput: confirmedContent,
                                                                content: confirmedContent,
                                                            },
                                                        }
                                                        yield `${JSON.stringify(confirmationMessage)} \n\n`
                                                        // Continue to next iteration - let LLM decide what to do next
                                                        continue
                                                    } else if (response === 'denied') {
                                                        console.log('[Chat] User denied, ending loop')
                                                        // User denied - add denial message and exit
                                                        const denialContent = JSON.stringify({
                                                            success: false,
                                                            confirm: true,
                                                            confirmed: false,
                                                            message: 'User denied the action',
                                                            prompt: 'The user has denied this action. Do NOT call any more tools. Simply inform the user that the action was denied.'
                                                        })
                                                        toolResults.push({
                                                            name: 'confirm',
                                                            content: denialContent,
                                                            toolCallId: handleResult.tool_call_id,
                                                            args: toolArgs,
                                                        })
                                                        const denialMessage = {
                                                            message: {
                                                                role: 'user',
                                                                toolResult: true,
                                                                toolCallId: handleResult.tool_call_id,
                                                                toolName: toolCall.name,
                                                                toolInput: toolArgs,
                                                                toolOutput: denialContent,
                                                                content: denialContent,
                                                            },
                                                        }
                                                        yield `${JSON.stringify(denialMessage)} \n\n`
                                                        shouldContinue = false
                                                        break
                                                    } else {
                                                        console.log('[Chat] Confirm timeout, ending loop')
                                                        // Timeout - exit
                                                        shouldContinue = false
                                                        break
                                                    }
                                                } else {
                                                    continue
                                                }
                                            }
                                            
                                            // Special handling for summarize tool - generate actual summary
                                            if (toolCall.name === 'summarize') {
                                            const summaryResult = await handleSummarizeTool(toolCall, currentMessages, llm, family)
                                            toolResults.push({
                                                name: toolCall.name,
                                                content: summaryResult.content,
                                                toolCallId: summaryResult.tool_call_id,
                                                args: toolCall.args,
                                            })
                                            
                                            const toolMessage = {
                                                message: {
                                                    role: 'user',
                                                    toolResult: true,
                                                    toolCallId: summaryResult.tool_call_id,
                                                    toolName: toolCall.name,
                                                    toolInput: toolCall.args,
                                                    toolOutput: summaryResult.content,
                                                    content: summaryResult.content,
                                                },
                                            }
                                            yield `${JSON.stringify(toolMessage)} \n\n`
                                            continue
                                        }
                                        
                                        if (selectedTool) {
                                            const result = await selectedTool.invoke(toolCall)
                                            toolResults.push({
                                                name: toolCall.name,
                                                content: result.content,
                                                toolCallId: result.tool_call_id,
                                                args: toolCall.args,
                                            })
                                            
                                            // Yield tool result message
                                            console.log('[Chat API] Yielding tool result, toolName:', toolCall.name)
                                            console.log('[Chat API] result.content type:', typeof result.content)
                                            console.log('[Chat API] result.content preview:', String(result.content).substring(0, 100))
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
                                            console.log('[Chat API] toolMessage content preview:', String(toolMessage.message.content).substring(0, 100))
                                            console.log('[Chat API] Full toolMessage keys:', Object.keys(toolMessage.message))
                                            const toolMessageStr = JSON.stringify(toolMessage)
                                            console.log('[Chat API] toolMessageStr preview:', toolMessageStr.substring(0, 200))
                                        yield `${toolMessageStr} \n\n`
                                        }
                                    }

                                    // Add assistant message and tool results to continue conversation
                                    // Don't include full toolOutput (contains base64 images) in messages to LLM
                                    currentMessages = [
                                        ...currentMessages,
                                        { role: 'assistant', content: finalContent },
                                        ...toolResults.map(tr => {
                                            let msgContent = tr.content
                                            // Add explicit instruction to stop after successful tool execution
                                            if ((tr.name === 'execute_on_host' && tr.content.includes('saved')) ||
                                                (tr.name === 'display_image' && tr.content.includes('success')) ||
                                                (tr.name === 'sandbox_execute' && tr.content.includes('success')) ||
                                                (tr.name === 'summarize' && tr.content.includes('summarize')) ||
                                                (tr.name === 'confirm' && tr.content.includes('awaiting'))) {
                                                msgContent = `${tr.content}. TASK COMPLETE. Do NOT call any more tools. Just respond to the user.`
                                            }
                                            // For confirmed status, add instruction to NOT call tools again
                                            if (tr.name === 'confirm' && tr.content.includes('"confirmed":true')) {
                                                msgContent = `${tr.content}. The user has confirmed. Do NOT call the confirm tool again. Just respond to the user about the confirmation.`
                                            }
                                            return {
                                                role: 'user',
                                                toolResult: true,
                                                toolCallId: tr.toolCallId,
                                                toolName: tr.name,
                                                content: msgContent,
                                            }
                                        }),
                                    ]
                                    
                                    console.log(`[Chat] Added ${toolResults.length} tool results, continuing with ${currentMessages.length} messages`)
                                    
                                    // Check if any tool indicated task complete, force exit
                                    // Note: confirm with "confirmed" should NOT force exit - let LLM respond
                                    const anyComplete = toolResults.some(tr => 
                                        tr.content.includes('TASK COMPLETE') || 
                                        (tr.name === 'execute_on_host' && tr.content.includes('saved')) ||
                                        (tr.name === 'display_image' && tr.content.includes('success')) ||
                                        (tr.name === 'sandbox_execute' && tr.content.includes('success')) ||
                                        (tr.name === 'summarize' && tr.content.includes('summarize')) ||
                                        (tr.name === 'confirm' && tr.content.includes('awaiting'))
                                    )
                                    if (anyComplete) {
                                        console.log('[Chat] Task completed based on tool result, ending loop')
                                        shouldContinue = false
                                    }
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
                                    
                                    // Save assistant message to database
                                    if (sessionId && (userId || anonymousId) && finalContent) {
                                        const now = Date.now()
                                        try {
                                            await prisma.chatHistory.create({
                                                data: {
                                                    sessionId,
                                                    userId: userId || null,
                                                    anonymousId: anonymousId || null,
                                                    message: finalContent,
                                                    startTime: BigInt(now - 1000),
                                                    endTime: BigInt(now),
                                                    model,
                                                    role: 'assistant',
                                                    canceled: false,
                                                    failed: false,
                                                    toolResult: false
                                                }
                                            })
                                            await prisma.chatSession.update({
                                                where: { id: sessionId },
                                                data: {
                                                    updateTime: BigInt(now),
                                                    attachedMessagesCount: { increment: 1 }
                                                }
                                            })
                                            console.log('[Chat] Assistant message saved to DB')
                                        } catch (e) {
                                            console.log('[Chat] Failed to save assistant message:', e)
                                        }
                                    }
                                    
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
