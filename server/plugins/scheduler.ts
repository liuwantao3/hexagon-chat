import { wikiService } from '../services/wiki'
import prisma from '../utils/prisma'

const DAILY_INGEST_HOUR = 0

async function runWikiIngest() {
  console.log('[Wiki Scheduler] Starting daily wiki ingest...')

  try {
    const users = await prisma.user.findMany({
      where: { is_active: true },
      select: { id: true }
    })

    console.log(`[Wiki Scheduler] Checking ${users.length} users`)

    for (const user of users) {
      try {
        const config = await wikiService.getOrCreateConfig(user.id)

        if (!config.enabled || !config.autoIngest) {
          continue
        }

        console.log(`[Wiki Scheduler] Processing user ${user.id}`)

        const summaries = await prisma.sessionSummary.findMany({
          where: { userId: user.id },
          select: { sessionId: true }
        })
        const summarizedSessionIds = new Set(summaries.map(s => s.sessionId))

        const chatHistory = await prisma.chatHistory.findMany({
          where: { userId: user.id },
          orderBy: [{ sessionId: 'asc' }, { startTime: 'asc' }],
          select: {
            id: true,
            sessionId: true,
            message: true,
            role: true
          }
        })

        const sessionMessages = new Map<number, Array<{role: string, content: string}>>()

        for (const msg of chatHistory) {
          if (!sessionMessages.has(msg.sessionId)) {
            sessionMessages.set(msg.sessionId, [])
          }
          try {
            const content = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message)
            sessionMessages.get(msg.sessionId)!.push({
              role: msg.role,
              content: content.substring(0, 1000)
            })
          } catch (e) {
          }
        }

        let processedCount = 0

        for (const [sessionId, messages] of sessionMessages) {
          if (summarizedSessionIds.has(sessionId)) continue
          if (messages.length < 2) continue

          try {
            const result = await wikiService.ingestSession(user.id, {
              sessionId,
              title: `Session ${sessionId}`,
              messages
            })

            if (result.entities.length > 0 || result.decisions.length > 0) {
              processedCount++
            }
          } catch (err) {
            console.error(`[Wiki Scheduler] Error processing session ${sessionId}:`, err)
          }
        }

        if (processedCount > 0) {
          console.log(`[Wiki Scheduler] User ${user.id}: processed ${processedCount} sessions, created wiki pages`)
        }
      } catch (err) {
        console.error(`[Wiki Scheduler] Error processing user ${user.id}:`, err)
      }
    }

    console.log('[Wiki Scheduler] Daily ingest complete')
  } catch (error) {
    console.error('[Wiki Scheduler] Error:', error)
  }
}

let schedulerInterval: NodeJS.Timeout | null = null

async function checkAndRun() {
  const currentHour = new Date().getHours()
  const currentDate = new Date().toDateString()
  const lastRunDate = globalThis.wikiSchedulerLastRunDate

  if (currentHour >= DAILY_INGEST_HOUR && lastRunDate !== currentDate) {
    globalThis.wikiSchedulerLastRunDate = currentDate
    try {
      await runWikiIngest()
    } catch (error) {
      console.error('[Wiki Scheduler] Run error:', error)
    }
  }
}

export default defineNitroPlugin(() => {
  checkAndRun()

  schedulerInterval = setInterval(checkAndRun, 15 * 60 * 1000)

  console.log('[Wiki Scheduler] Plugin initialized - checks every 15min, runs after midnight')
})