export interface ChatMessage {
  id?: number
  role: 'system' | 'assistant' | 'user'
  model: string
  content: string | (TextContent | ImageContent)[] //need to update to support images
  type?: 'loading' | 'canceled' | 'error'
  startTime: number
  endTime: number
  relevantDocs?: RelevantDocument[]
  toolResult: boolean
  toolCallId?: string
  toolName?: string
  toolInput?: any
  toolOutput?: string
  toolCalls?: Array<{ name: string, args: any }>
}

interface TextContent {
  type: 'text'
  text: string
}
interface ImageContent {
  type: 'image_url'
  image_url: string
}
