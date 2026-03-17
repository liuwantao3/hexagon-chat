import prisma from '@/server/utils/prisma'
import { saveAudioFile, deleteAudioFile } from '@/server/utils/audioStorage'

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

  const body = await readBody(event)
  const { audio_hex, voice_id, model, speed, emotion } = body

  if (!audio_hex) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Audio hex data required'
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

  const audioBuffer = Buffer.from(audio_hex, 'hex')
  const audioPath = await saveAudioFile(story.id, audioBuffer)

  const updated = await prisma.story.update({
    where: { id: story.id },
    data: {
      audio_path: audioPath,
      updated_at: new Date()
    }
  })

  return {
    success: true,
    audio_path: audioPath,
    story: updated
  }
})
