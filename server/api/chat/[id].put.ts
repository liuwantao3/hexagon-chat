import { defineEventHandler, getRouterParam, readBody, createError, getQuery } from 'h3'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const body = await readBody(event)
  
  const userId = query.userId ? parseInt(query.userId as string) : null
  const anonymousId = query.anonymousId as string | undefined

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'sessionId is required'
    })
  }

  const id = parseInt(sessionId)

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id }
    })

    if (!session) {
      throw createError({
        statusCode: 404,
        message: 'Session not found'
      })
    }

    // Allow update if either userId OR anonymousId matches (handles login/merge scenarios)
    const userIdMatches = userId && session.userId === userId
    const anonIdMatches = anonymousId && session.anonymousId === anonymousId
    if (!userIdMatches && !anonIdMatches) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized'
      })
    }

    const updateData: any = {
      updateTime: Date.now()
    }
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.models !== undefined) updateData.models = JSON.stringify(body.models)
    if (body.isTop !== undefined) updateData.isTop = body.isTop

    const updated = await prisma.chatSession.update({
      where: { id },
      data: updateData
    })

    return {
      id: updated.id,
      title: updated.title,
      updateTime: Number(updated.updateTime),
      isTop: Number(updated.isTop)
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[Update Session API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to update session: ${error.message}`
    })
  }
})