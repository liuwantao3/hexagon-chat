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
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const skip = (page - 1) * limit

  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        genre: true,
        topic: true,
        difficulty: true,
        length: true,
        status: true,
        created_at: true,
        audio_path: true,
        voice_speed: true,
        image_path: true,
        image_url: true,
        updated_at: true
      }
    }),
    prisma.story.count()
  ])

  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || ''

  return {
    stories: stories.map(story => ({
      ...story,
      audio_url: story.audio_path ? `${baseUrl}${story.audio_path}` : null,
      image_url: story.image_path ? `${baseUrl}${story.image_path}` : (story.image_url || null)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
})
