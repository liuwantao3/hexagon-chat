import { defineEventHandler, readBody } from 'h3'
import { wikiService } from '~/server/services/wiki'

interface ConfigUpdate {
  enabled?: boolean
  autoIngest?: boolean
  ingestHours?: number
  summarizerModel?: string
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<ConfigUpdate>(event)

  try {
    const config = await wikiService.updateConfig(userId, body)

    return {
      success: true,
      config: {
        enabled: config.enabled,
        autoIngest: config.autoIngest,
        ingestHours: config.ingestHours,
        summarizerModel: config.summarizerModel,
        lastIngest: config.lastIngest,
        lastLint: config.lastLint
      }
    }
  } catch (error: any) {
    console.error('[Wiki Config] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})