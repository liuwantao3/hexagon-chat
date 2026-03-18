import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Story ID required'
    })
  }

  const story = await prisma.story.findUnique({
    where: { id }
  })

  if (!story) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Story not found'
    })
  }

  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || ''

  return {
    id: story.id,
    title: story.title,
    content: story.content,
    genre: story.genre,
    topic: story.topic,
    difficulty: story.difficulty,
    length: story.length,
    status: story.status,
    created_at: story.created_at.toISOString(),
    updated_at: story.updated_at.toISOString(),
    audio_url: story.audio_path ? `${baseUrl}${story.audio_path}` : null,
    voice_speed: story.voice_speed || 1.0,
    image_url: story.image_path ? `${baseUrl}${story.image_path}` : story.image_url,
    sentence_timestamps: story.sentence_timestamps ? JSON.parse(story.sentence_timestamps) : null
  }
})
