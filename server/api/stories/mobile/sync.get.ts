import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const since = query.since as string | undefined

  const whereClause = since ? {
    updated_at: {
      gt: new Date(since)
    }
  } : {}

  const [count, latestStory] = await Promise.all([
    prisma.story.count({ where: whereClause }),
    prisma.story.findFirst({
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true }
    })
  ])

  return {
    hasUpdates: count > 0,
    newCount: count,
    latestUpdate: latestStory?.updated_at?.toISOString() || null,
    serverTime: new Date().toISOString()
  }
})
