import prisma from '@/server/utils/prisma'
import { deleteImageFile } from '@/server/utils/imageStorage'

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

  if (story.image_path) {
    await deleteImageFile(story.image_path)
  }

  const updated = await prisma.story.update({
    where: { id: story.id },
    data: {
      image_path: null,
      image_url: null,
      updated_at: new Date()
    }
  })

  return {
    success: true,
    story: updated
  }
})
