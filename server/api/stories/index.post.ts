import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  
  const story = await prisma.story.create({
    data: {
      title: body.title,
      content: body.content,
      genre: body.genre,
      topic: body.topic,
      difficulty: body.difficulty,
      reference: body.reference || null,
      length: body.length || null,
      status: body.status || 'draft',
      updated_at: new Date()
    }
  })

  return story
})
