import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  if (!keys) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const paragraphs = await prisma.learningParagraph.findMany({
    orderBy: { orderIndex: 'asc' }
  })

  return paragraphs.map(p => ({
    id: p.id,
    theme: p.theme,
    nouns: JSON.parse(p.nouns),
    content: p.content,
    wordCount: p.wordCount,
    status: p.status,
    orderIndex: p.orderIndex,
    created_at: p.created_at,
    updated_at: p.updated_at
  }))
})
