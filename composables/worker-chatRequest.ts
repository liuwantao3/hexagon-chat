import type { SetRequired } from 'type-fest'
import type { ChatMessage } from '~/types/chat'
import type { ChatHistory } from '~/composables/clientDB'

type RelevantDocument = Required<ChatHistory>['relevantDocs'][number]
type ResponseRelevantDocument = { type: 'relevant_documents', relevant_documents: RelevantDocument[] }
type ResponseMessage = { message: { role: string, content: string, toolResult?: boolean, toolCallId?: string, name?: string } }

interface RequestData {
  sessionId: number
  knowledgebaseId?: number
  /** format: `family::model` */
  model: string
  messages: Array<SetRequired<Partial<ChatMessage>, 'role' | 'content' | 'toolResult' | 'toolCallId'>>
  stream: boolean
  timestamp: number
  skills?: string[]
  userId?: number
  anonymousId?: string
}

export type WorkerReceivedMessage =
  | { type: 'request', uid: number, data: RequestData, headers: Record<string, any> }
  | { type: 'abort', uid?: number, sessionId: number }

export type WorkerSendMessage = { uid: number, sessionId: number, id: number, } & (
  | { type: 'message', data: ChatMessage }
  | { type: 'relevant_documents', data: ChatMessage }
  | { type: 'error', message: string }
  | { type: 'complete' }
  | { type: 'abort' }
)

const MODEL_FAMILY_SEPARATOR = '/'

const abortHandlerMap = new Map<string /** sessionId:uid */, () => void>()

function sendMessageToMain(data: WorkerSendMessage) {
  postMessage(data)
}

function parseModelValue(val: string) {
  const [family, ...parts] = val.split(MODEL_FAMILY_SEPARATOR)
  return { family, name: parts.join(MODEL_FAMILY_SEPARATOR) }
}

async function chatRequest(uid: number, data: RequestData, headers: Record<string, any>) {
  /** indexedDB `id` */
  let id = -1
  let msgContent = ''
  const controller = new AbortController()

  abortHandlerMap.set(`${data.sessionId}:${uid}`, () => {
    controller.abort()
    updateToDB({ id, canceled: true, message: msgContent })
    sendMessageToMain({ uid, id, sessionId: data.sessionId, type: 'abort' })
  })

  const { family, name: model } = parseModelValue(data.model)

  console.log("Message being sending out:", data.messages)

  const response = await fetch('/api/models/chat', {
    method: 'POST',
    body: JSON.stringify({
      knowledgebaseId: data.knowledgebaseId,
      model,
      family,
      messages: data.messages,
      stream: data.stream,
      skills: data.skills,
      sessionId: data.sessionId,
      userId: data.userId,
      anonymousId: data.anonymousId,
    }),
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  })

  if (response.status !== 200) {
    const { message: responseMessage } = await response.json()
    const errInfo = responseMessage || `Status Code ${response.status}${' - ' + response.statusText}`
    id = await addToDB({
      sessionId: data.sessionId,
      role: 'assistant',
      message: errInfo,
      model: data.model,
      knowledgeBaseId: data.knowledgebaseId,
      failed: true,
      canceled: false,
      startTime: data.timestamp,
      endTime: Date.now(),
      toolResult: false
    }, data.userId, data.anonymousId)
    sendMessageToMain({ uid, type: 'error', sessionId: data.sessionId, id, message: errInfo })
    sendMessageToMain({ id, uid, sessionId: data.sessionId, type: 'complete' })
  } else if (response.body) {
    const reader = response.body.getReader()
    const splitter = ' \n\n'
    let prevPart = ''
    const relevantDocs: RelevantDocument[] = []
    let t = Date.now()

    while (true) {
      const { value, done } = await reader.read().catch((err: any) => {
        if (err.name !== 'AbortError') {
          throw err
        }
        return { done: true, value: undefined }
      })
      if (done) break

      const chunk = prevPart + new TextDecoder().decode(value)
      prevPart = ''

      for (const line of chunk.split(splitter)) {
        if (!line) continue

        // Accumulate partial content until we have a complete JSON (starts with { and ends with })
        prevPart += line
        
        // Try to detect complete JSON by checking if it has balanced braces
        const tryParse = prevPart.trim()
        if (!tryParse.startsWith('{')) {
          prevPart = ''
          continue
        }
        
        // Count braces to detect complete JSON
        let braceCount = 0
        let inString = false
        let escape = false
        for (const char of tryParse) {
          if (escape) {
            escape = false
            continue
          }
          if (char === '\\') {
            escape = true
            continue
          }
          if (char === '"') {
            inString = !inString
            continue
          }
          if (!inString) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }
        }
        
        // If braces are balanced, we have a complete JSON
        if (braceCount === 0 && tryParse.endsWith('}')) {
          const lineToParse = prevPart.trim()
          prevPart = ''
          
          // DEBUG: Log raw line
          console.log('[Worker] Raw line (complete):', lineToParse.substring(0, 200))
          console.log('[Worker] Line length:', lineToParse.length)
          
          // Try to parse
          let chatMessage
          try {
            chatMessage = JSON.parse(lineToParse) as ResponseMessage | ResponseRelevantDocument
            console.log('[Worker] Parsed message keys:', Object.keys(chatMessage))
            if ('message' in chatMessage) {
              console.log('[Worker] message.toolResult:', chatMessage.message.toolResult, 'toolName:', chatMessage.message.toolName)
              console.log('[Worker] message.content preview:', String(chatMessage.message.content).substring(0, 100))
            }
          } catch (e) {
            console.warn('JSON parse error:', e)
            continue
          }
          
          const isMessage = !('type' in chatMessage) && 'message' in chatMessage
          const isToolResult = isMessage && chatMessage.message.toolResult === true
          
          // DEBUG: Log what we actually received
          if (isMessage) {
            console.log('[Worker] Full message keys:', Object.keys(chatMessage.message))
            console.log('[Worker] toolResult value:', chatMessage.message.toolResult, 'type:', typeof chatMessage.message.toolResult)
          }
          
          // Handle flow_complete event from multi-tool loop
          if ('type' in chatMessage && chatMessage.type === 'flow_complete') {
            console.log('[Worker] Flow complete, sending complete event')
            sendMessageToMain({ id, uid, sessionId: data.sessionId, type: 'complete' })
            break
          }

          if (isMessage) {
            console.log('[Worker] Message received, isToolResult:', isToolResult, 'toolCalls:', chatMessage.message.toolCalls?.length || 0, 'content length:', chatMessage.message.content?.length)
            
            if (isToolResult) {
              // Tool result - store separately with its content
              msgContent = chatMessage.message.content
              console.log('[Worker] Tool result stored, toolName:', chatMessage.message.toolName)
            } else {
              // Assistant message
              if (id === -1) {
                msgContent = chatMessage.message.content
              } else {
                msgContent = chatMessage.message.content
              }
              console.log('[Worker] Assistant message stored, toolCalls:', chatMessage.message.toolCalls?.length || 0)
            }
          }

          const result: ChatHistory = {
            role: isToolResult ? 'user' as const : 'assistant' as const,
            model: data.model,
            sessionId: data.sessionId,
            message: msgContent,
            failed: false,
            canceled: false,
            startTime: Date.now(),
            endTime: Date.now(),
            toolResult: isToolResult,
            toolCallId: isToolResult ? chatMessage.message.toolCallId : undefined,
            toolName: isToolResult ? chatMessage.message.toolName : undefined,
            toolInput: isToolResult ? chatMessage.message.toolInput : undefined,
            toolOutput: isToolResult ? chatMessage.message.toolOutput : undefined,
            toolCalls: chatMessage.message.toolCalls,
          }

          // Create new record for tool results OR new iteration responses
          const isNewIteration = chatMessage.message.toolCalls?.length > 0
          const shouldCreateNew = isToolResult || isNewIteration
          
          if (id === -1 || shouldCreateNew) {
            console.log('[Worker] Creating new message, isToolResult:', isToolResult, 'isNewIteration:', isNewIteration)
            // Only save tool results via addToDB - SSE already saves assistant messages directly
            if (isToolResult) {
              id = await addToDB(result, data.userId, data.anonymousId)
            } else {
              // For assistant messages, SSE handles DB save - just use a temp id for UI
              id = Math.random()
            }
          } else {
            // Update existing record for incremental content
            console.log('[Worker] Updating existing message, id:', id)
            if (isMessage && Date.now() - t > 1000) {
              t = Date.now()
              updateToDB({ id, message: msgContent })
            }
          }
          
          // After tool result, reset id to -1 so next iteration creates new record
          if (isToolResult) {
            console.log('[Worker] Tool result processed, resetting id for next iteration')
            id = -1
          }

          if (isMessage) {
            const toolCalls = chatMessage.message.toolCalls
            const contentRole = isToolResult ? 'user' : 'assistant'
            sendMessageToMain({
              uid, type: 'message', sessionId: data.sessionId, id,
              data: {
                id,
                content: msgContent,
                startTime: data.timestamp,
                endTime: Date.now(),
                role: contentRole,
                model: data.model,
                toolResult: isToolResult,
                toolCallId: isToolResult ? chatMessage.message.toolCallId : undefined,
                toolName: isToolResult ? chatMessage.message.toolName : undefined,
                toolInput: isToolResult ? chatMessage.message.toolInput : undefined,
                toolOutput: isToolResult ? chatMessage.message.toolOutput : undefined,
                toolCalls: toolCalls,
              }
            })
          } else if (chatMessage.type === 'relevant_documents') {
            relevantDocs.push(...chatMessage.relevant_documents)
            sendMessageToMain({
              uid, type: 'relevant_documents', sessionId: data.sessionId, id,
              data: {
                id,
                content: msgContent,
                startTime: data.timestamp,
                endTime: Date.now(),
                role: 'assistant',
                model: data.model,
                relevantDocs: chatMessage.relevant_documents,
                toolResult: false
              },
            })
          }
        } else {
          // Incomplete JSON, wait for more data
          console.log('[Worker] Incomplete JSON, accumulating... braceCount:', braceCount)
          continue
        }
      }
    }

    await updateToDB({
      id,
      message: msgContent,
      relevantDocs: relevantDocs.map(el => {
        const pageContent = el.pageContent.slice(0, 200) + (el.pageContent.length > 200 ? '...' : '') // Avoid saving large-sized content
        return { ...el, pageContent }
      })
    })
    sendMessageToMain({ id, uid, sessionId: data.sessionId, type: 'complete' })
  }
  abortHandlerMap.delete(`${data.sessionId}:${uid}`)
}

async function addToDB(data: Omit<ChatHistory, 'id'>, userId?: number, anonymousId?: string) {
  try {
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: data.sessionId,
        userId,
        anonymousId,
        message: data.message,
        startTime: data.startTime,
        endTime: data.endTime,
        model: data.model,
        role: data.role,
        canceled: data.canceled,
        failed: data.failed,
        instructionId: data.instructionId,
        knowledgeBaseId: data.knowledgeBaseId,
        relevantDocs: data.relevantDocs,
        toolResult: data.toolResult,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        toolInput: data.toolInput,
        toolOutput: data.toolOutput,
        toolCalls: data.toolCalls,
      })
    })
    if (!response.ok) {
      console.error('[addToDB] Failed to save message:', response.statusText)
      return Math.random()
    }
    const result = await response.json()
    return result.id
  } catch (error) {
    console.error('[addToDB] Error:', error)
    return Math.random()
  }
}

async function updateToDB(data: SetRequired<Partial<ChatHistory>, 'id'>) {
  // Tool results don't need updating once created
  console.log('[updateToDB] Called with id:', data.id, '(no-op for tool results)')
}

self.addEventListener('message', (e: MessageEvent<WorkerReceivedMessage>) => {
  const data = e.data
  if (data.type === 'request') {
    chatRequest(data.uid, data.data, data.headers)
  } else if (data.type === 'abort') {
    if (data.uid) {
      const key = `${data.sessionId}:${data.uid}`
      abortHandlerMap.get(key)?.()
      abortHandlerMap.delete(key)
    } else {
      // Abort specific session's all chat requests
      Array.from(abortHandlerMap.keys()).map(key => {
        if (key.startsWith(`${data.sessionId}:`)) {
          abortHandlerMap.get(key)?.()
          abortHandlerMap.delete(key)
        }
      })
    }
  }
})
