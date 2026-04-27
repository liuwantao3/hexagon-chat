import Dexie, { type Table } from 'dexie'

export interface ChatSession {
  id?: number
  userId?: string | null
  title: string
  createTime: number
  updateTime: number
  model?: string
  modelFamily?: string
  models?: string[]
  instructionId?: number
  knowledgeBaseId?: number
  attachedMessagesCount: number
  isTop: number
}

export interface ChatHistory {
  id?: number
  userId?: string | null
  sessionId: number
  message: string | any[]
  startTime: number
  endTime: number
  model: string
  role: 'user' | 'assistant'
  canceled: boolean
  failed: boolean
  instructionId?: number
  knowledgeBaseId?: number
  relevantDocs?: Array<{
    pageContent: string
    metadata: {
      blobType: string
      source: string
    }
  }>,
  toolResult: boolean,
  toolCallId?: string,
  toolName?: string,
  toolInput?: any,
  toolOutput?: string,
  toolCalls?: Array<{ name: string, args: any }>
}

export class MySubClassedDexie extends Dexie {
  // 'chatHistories' is added by dexie when declaring the stores()
  // We just tell the typing system this is the case
  chatHistories!: Table<ChatHistory>
  chatSessions!: Table<ChatSession>

  // constructor() {
  //   super('hexagon-chat')
  //   this.version(2).stores({
  //     chatSessions: '++id, updateTime',
  //     chatHistories: '++id, sessionId', // Primary key and indexed props
  //   })
  // }

  constructor() {
    super('hexagon-chat')
    this.version(3).stores({
      chatSessions: '++id, userId, updateTime',
      chatHistories: '++id,userId, sessionId',
    })
  }

}

export const clientDB = new MySubClassedDexie()
