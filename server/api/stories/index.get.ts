import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const stories = await prisma.story.findMany({
    orderBy: {
      created_at: 'desc'
    }
  })

  return stories
})
