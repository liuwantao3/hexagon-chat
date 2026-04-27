import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '~/server/utils/prisma'

interface MergeSessionsBody {
  userId: number
  anonymousId: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<MergeSessionsBody>(event)
  const { userId, anonymousId } = body

  if (!userId || !anonymousId) {
    throw createError({
      statusCode: 400,
      message: 'userId and anonymousId are required'
    })
  }

  try {
    // Update all sessions with the anonymousId to belong to the user
    const result = await prisma.chatSession.updateMany({
      where: { anonymousId },
      data: {
        userId,
        anonymousId: null
      }
    })

    // Update all messages as well
    await prisma.chatHistory.updateMany({
      where: { anonymousId },
      data: {
        userId,
        anonymousId: null
      }
    })

    console.log(`[Merge Sessions] Merged ${result.count} sessions for user ${userId}`)

    return {
      success: true,
      mergedCount: result.count
    }
  } catch (error: any) {
    console.error('[Merge Sessions API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to merge sessions: ${error.message}`
    })
  }
})