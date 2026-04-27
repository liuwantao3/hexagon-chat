import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  const userId = query.userId ? parseInt(query.userId as string) : null
  const anonymousId = query.anonymousId as string | undefined

  if (!userId && !anonymousId) {
    throw createError({
      statusCode: 400,
      message: 'userId or anonymousId is required'
    })
  }

  // Support querying sessions for both userId AND anonymousId (for handling logout/merge scenarios)
  const where: any = {}
  if (userId && anonymousId) {
    console.log(`[Sessions API] Querying both userId=${userId} AND anonymousId=${anonymousId}`)
    // Query both - will match sessions that have EITHER userId or anonymousId
    where.OR = [
      { userId },
      { anonymousId }
    ]
  } else if (userId) {
    where.userId = userId
  } else if (anonymousId) {
    where.anonymousId = anonymousId
  }

  try {
    const sessions = await prisma.chatSession.findMany({
      where,
      orderBy: { updateTime: 'desc' },
      take: 50,
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })

    console.log(`[Sessions API] Found ${sessions.length} sessions:`, sessions.map(s => ({ id: s.id, title: s.title, userId: s.userId, anonymousId: s.anonymousId })))

    return sessions.map(s => ({
      id: s.id,
      title: s.title,
      createTime: Number(s.createTime),
      updateTime: Number(s.updateTime),
      model: s.model,
      modelFamily: s.modelFamily,
      models: s.models ? JSON.parse(s.models) : null,
      instructionId: s.instructionId,
      knowledgeBaseId: s.knowledgeBaseId,
      attachedMessagesCount: s.attachedMessagesCount,
      isTop: Number(s.isTop),
      messageCount: s._count.messages
    }))
  } catch (error: any) {
    console.error('[Chat Sessions API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to get sessions: ${error.message}`
    })
  }
})