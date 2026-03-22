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
  const { paragraphs } = body

  if (!Array.isArray(paragraphs)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'paragraphs must be an array'
    })
  }

  const results = []
  
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const wordCount = p.content.split(/\s+/).filter(Boolean).length
    
    const result = await prisma.learningParagraph.upsert({
      where: { id: p.id || 0 },
      create: {
        theme: p.theme,
        nouns: JSON.stringify(p.nouns),
        content: p.content,
        wordCount,
        status: 'saved',
        orderIndex: i,
        updated_at: new Date()
      },
      update: {
        theme: p.theme,
        nouns: JSON.stringify(p.nouns),
        content: p.content,
        wordCount,
        status: 'saved',
        orderIndex: i,
        updated_at: new Date()
      }
    })
    
    results.push({
      id: result.id,
      theme: result.theme,
      nouns: JSON.parse(result.nouns),
      content: result.content,
      wordCount: result.wordCount,
      status: result.status,
      orderIndex: result.orderIndex,
      created_at: result.created_at,
      updated_at: result.updated_at
    })
  }

  return {
    success: true,
    saved: results.length,
    paragraphs: results
  }
})
