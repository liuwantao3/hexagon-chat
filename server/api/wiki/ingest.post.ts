import { defineEventHandler, readBody } from 'h3'
import { wikiService } from '~/server/services/wiki'

interface IngestRequest {
  sessions: Array<{
    sessionId: number
    title: string
    messages: Array<{
      role: string
      content: string
    }>
  }>
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<IngestRequest>(event)
  const { sessions } = body

  if (!sessions || sessions.length === 0) {
    return {
      success: false,
      message: 'sessions array is required'
    }
  }

  console.log(`[Wiki Ingest API] Starting for user ${userId}, ${sessions.length} sessions`)

  const results = []
  let processedCount = 0

  try {
    for (const session of sessions) {
      try {
        const result = await wikiService.ingestSession(userId, {
          sessionId: session.sessionId,
          title: session.title,
          messages: session.messages
        })
        results.push({
          sessionId: session.sessionId,
          success: true,
          entities: result.entities.length,
          decisions: result.decisions.length,
          isInvestigation: result.isInvestigation
        })
        processedCount++
      } catch (err: any) {
        console.error(`[Wiki Ingest API] Error processing session ${session.sessionId}:`, err)
        results.push({
          sessionId: session.sessionId,
          success: false,
          error: err.message
        })
      }
    }

    const stats = await wikiService.getStats(userId)

    return {
      success: true,
      processed: processedCount,
      total: sessions.length,
      results,
      stats
    }
  } catch (error: any) {
    console.error('[Wiki Ingest API] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})