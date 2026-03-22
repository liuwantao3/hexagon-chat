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
      statusMessage: 'Invalid ID'
    })
  }

  await prisma.learningParagraph.delete({
    where: { id }
  })

  return { success: true, id }
})
