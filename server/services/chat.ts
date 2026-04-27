import prisma from '../utils/prisma'

export interface CreateSessionParams {
  userId?: number
  anonymousId?: string
  title: string
  model?: string
  modelFamily?: string
  models?: string[]
  instructionId?: number
  knowledgeBaseId?: number
}

export interface SaveMessageParams {
  sessionId: number
  userId?: number
  anonymousId?: string
  message: string
  startTime: number
  endTime: number
  model: string
  role: string
  canceled?: boolean
  failed?: boolean
  instructionId?: number
  knowledgeBaseId?: number
  relevantDocs?: Array<{ pageContent: string, metadata: any }>
  toolResult?: boolean
  toolCallId?: string
  toolName?: string
  toolInput?: any
  toolOutput?: string
  toolCalls?: Array<{ name: string, args: any }>
}

export interface ChatSessionWithMessages {
  id: number
  title: string
  createTime: number
  updateTime: number
  model?: string
  modelFamily?: string
  messages: Array<{
    id: number
    message: string
    role: string
    startTime: number
    endTime: number
    toolResult: boolean
    toolCallId?: string
    toolName?: string
  }>
}

class ChatService {
  async createSession(params: CreateSessionParams) {
    const now = BigInt(Date.now())
    return prisma.chatSession.create({
      data: {
        userId: params.userId || null,
        anonymousId: params.anonymousId || null,
        title: params.title,
        createTime: now,
        updateTime: now,
        model: params.model || null,
        modelFamily: params.modelFamily || null,
        models: params.models ? JSON.stringify(params.models) : null,
        instructionId: params.instructionId || null,
        knowledgeBaseId: params.knowledgeBaseId || null,
        attachedMessagesCount: 0,
        isTop: BigInt(0)
      }
    })
  }

  async getSessions(params: { userId?: number; anonymousId?: string; limit?: number }) {
    const where: any = {}
    if (params.userId) {
      where.userId = params.userId
    } else if (params.anonymousId) {
      where.anonymousId = params.anonymousId
    }

    return prisma.chatSession.findMany({
      where,
      orderBy: { updateTime: 'desc' },
      take: params.limit || 50,
      include: {
        _count: { select: { messages: true } }
      }
    })
  }

  async getSession(id: number) {
    return prisma.chatSession.findUnique({
      where: { id }
    })
  }

  async updateSession(id: number, data: Partial<CreateSessionParams>) {
    const { userId, anonymousId, title, model, modelFamily, models, instructionId, knowledgeBaseId } = data
    return prisma.chatSession.update({
      where: { id },
      data: {
        userId: userId ?? undefined,
        anonymousId: anonymousId ?? undefined,
        title,
        model,
        modelFamily,
        models: models ? JSON.stringify(models) : undefined,
        instructionId: instructionId ?? undefined,
        knowledgeBaseId: knowledgeBaseId ?? undefined,
        updateTime: BigInt(Date.now())
      }
    })
  }

  async deleteSession(id: number) {
    return prisma.chatSession.delete({
      where: { id }
    })
  }

  async getMessages(sessionId: number) {
    return prisma.chatHistory.findMany({
      where: { sessionId },
      orderBy: { startTime: 'asc' }
    })
  }

  async saveMessage(params: SaveMessageParams) {
    const chatMessage = await prisma.chatHistory.create({
      data: {
        sessionId: params.sessionId,
        userId: params.userId || null,
        anonymousId: params.anonymousId || null,
        message: typeof params.message === 'string' ? params.message : JSON.stringify(params.message),
        startTime: BigInt(params.startTime),
        endTime: BigInt(params.endTime),
        model: params.model,
        role: params.role,
        canceled: params.canceled || false,
        failed: params.failed || false,
        instructionId: params.instructionId || null,
        knowledgeBaseId: params.knowledgeBaseId || null,
        relevantDocs: params.relevantDocs ? JSON.stringify(params.relevantDocs) : null,
        toolResult: params.toolResult || false,
        toolCallId: params.toolCallId || null,
        toolName: params.toolName || null,
        toolInput: params.toolInput ? JSON.stringify(params.toolInput) : null,
        toolOutput: params.toolOutput || null,
        toolCalls: params.toolCalls ? JSON.stringify(params.toolCalls) : null
      }
    })

    await prisma.chatSession.update({
      where: { id: params.sessionId },
      data: {
        updateTime: BigInt(params.endTime),
        attachedMessagesCount: { increment: 1 }
      }
    })

    return chatMessage
  }

  async mergeAnonymousSessions(userId: number, anonymousId: string) {
    const result = await prisma.chatSession.updateMany({
      where: { anonymousId },
      data: {
        userId,
        anonymousId: null
      }
    })

    await prisma.chatHistory.updateMany({
      where: { anonymousId },
      data: {
        userId,
        anonymousId: null
      }
    })

    return result.count
  }

  async getSessionCount(userId?: number, anonymousId?: string) {
    const where: any = {}
    if (userId) {
      where.userId = userId
    } else if (anonymousId) {
      where.anonymousId = anonymousId
    }

    return prisma.chatSession.count({ where })
  }
}

export const chatService = new ChatService()