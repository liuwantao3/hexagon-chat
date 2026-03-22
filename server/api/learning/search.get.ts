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
  const noun = (query.noun as string || '').toLowerCase().trim()

  if (!noun) {
    throw createError({
      statusCode: 400,
      statusMessage: 'noun query parameter is required'
    })
  }

  const paragraphs = await prisma.learningParagraph.findMany({
    orderBy: { orderIndex: 'asc' }
  })

  const matching = paragraphs.filter(p => {
    const nouns: string[] = JSON.parse(p.nouns)
    return nouns.some(n => n.toLowerCase().includes(noun))
  })

  return matching.map(p => ({
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
