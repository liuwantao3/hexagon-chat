import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const id = parseInt(event.context.params?.id)

  await prisma.story.delete({
    where: { id }
  })

  return { success: true }
})
