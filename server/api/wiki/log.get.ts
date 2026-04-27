import { defineEventHandler, getQuery } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : 50

  try {
    const logs = await wikiService.getLog(userId, limit)

    return {
      success: true,
      logs
    }
  } catch (error: any) {
    console.error('[Wiki Log] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})