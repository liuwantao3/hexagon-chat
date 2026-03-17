import prisma from '@/server/utils/prisma'
import { deleteAudioFile } from '@/server/utils/audioStorage'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const storyId = getRouterParam(event, 'id')
  if (!storyId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Story ID required'
    })
  }

  const story = await prisma.story.findUnique({
    where: { id: parseInt(storyId) }
  })

  if (!story) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Story not found'
    })
  }

  if (story.audio_path) {
    await deleteAudioFile(story.audio_path)
  }

  const updated = await prisma.story.update({
    where: { id: story.id },
    data: {
      audio_path: null,
      updated_at: new Date()
    }
  })

  return {
    success: true,
    story: updated
  }
})
