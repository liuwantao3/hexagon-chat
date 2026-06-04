import { defineEventHandler, getQuery, createError, getRouterParam } from 'h3'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const query = getQuery(event)
  
  const userId = query.userId ? parseInt(query.userId as string) : null
  const anonymousId = query.anonymousId as string | undefined

  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'sessionId is required' })
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

  try {
    const count = await prisma.chatHistory.count({ where: { sessionId: id } })
    return { count }
  } catch (error: any) {
    console.error('[Chat Messages Count API] Error:', error)
    throw createError({ statusCode: 500, message: `Failed to get count: ${error.message}` })
  }
})