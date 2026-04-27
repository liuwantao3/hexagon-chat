import { defineEventHandler, getQuery } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const graph = await wikiService.getGraph(userId)

    return {
      success: true,
      graph
    }
  } catch (error: any) {
    console.error('[Wiki Graph] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})