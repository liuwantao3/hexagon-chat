import { defineEventHandler, getQuery, createError, getRouterParam } from 'h3'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const query = getQuery(event)
  
  const userId = query.userId ? parseInt(query.userId as string) : null
  const anonymousId = query.anonymousId as string | undefined

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'sessionId is required'
    })
  }

  const id = parseInt(sessionId)

  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  
  const userIdMatches = userId && session.userId === userId
  const anonIdMatches = anonymousId && session.anonymousId === anonymousId
  if (!userIdMatches && !anonIdMatches) {
    throw createError({ statusCode: 403, message: 'Not authorized' })
  }

  const where: any = { sessionId: id }
  const take = query.take ? parseInt(query.take as string) : undefined
  const cursor = query.cursor ? parseInt(query.cursor as string) : undefined
  const orderBy = query.orderBy === 'asc' ? { startTime: 'asc' as const } : { id: 'desc' as const }

  if (cursor !== undefined) {
    where.id = { lt: cursor }
  }

  try {
    const messages = await prisma.chatHistory.findMany({
      where,
      orderBy,
      take,
    })

    const hasMore = messages.length === (take || 20)

    return {
      messages: messages.map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        message: m.message,
        startTime: Number(m.startTime),
        endTime: Number(m.endTime),
        model: m.model,
        role: m.role,
        canceled: m.canceled,
        failed: m.failed,
        instructionId: m.instructionId,
        knowledgeBaseId: m.knowledgeBaseId,
        relevantDocs: m.relevantDocs ? JSON.parse(m.relevantDocs) : null,
        toolResult: m.toolResult,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        toolInput: m.toolInput ? JSON.parse(m.toolInput) : null,
        toolOutput: m.toolOutput,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null
      })),
      hasMore,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : undefined
    }
  } catch (error: any) {
    console.error('[Chat Messages API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to get messages: ${error.message}`
    })
  }
})