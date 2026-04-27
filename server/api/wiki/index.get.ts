import { defineEventHandler, getQuery } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const config = await wikiService.getOrCreateConfig(userId)
    const stats = await wikiService.getStats(userId)
    const index = await wikiService.getIndex(userId)

    return {
      success: true,
      config: {
        enabled: config.enabled,
        autoIngest: config.autoIngest,
        ingestHours: config.ingestHours,
        summarizerModel: config.summarizerModel,
        lastIngest: config.lastIngest,
        lastLint: config.lastLint
      },
      stats,
      index
    }
  } catch (error: any) {
    console.error('[Wiki API] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})