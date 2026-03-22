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
  
  const { id, theme, nouns, content, status, orderIndex } = body
  
  const wordCount = content.split(/\s+/).filter(Boolean).length

  if (id) {
    const paragraph = await prisma.learningParagraph.update({
      where: { id },
      data: {
        theme,
        nouns: JSON.stringify(nouns),
        content,
        wordCount,
        status: status || 'draft',
        orderIndex: orderIndex ?? 0,
        updated_at: new Date()
      }
    })
    return {
      id: paragraph.id,
      theme: paragraph.theme,
      nouns: JSON.parse(paragraph.nouns),
      content: paragraph.content,
      wordCount: paragraph.wordCount,
      status: paragraph.status,
      orderIndex: paragraph.orderIndex,
      created_at: paragraph.created_at,
      updated_at: paragraph.updated_at
    }
  }

  const paragraph = await prisma.learningParagraph.create({
    data: {
      theme,
      nouns: JSON.stringify(nouns),
      content,
      wordCount,
      status: status || 'draft',
      orderIndex: orderIndex ?? 0,
      updated_at: new Date()
    }
  })

  return {
    id: paragraph.id,
    theme: paragraph.theme,
    nouns: JSON.parse(paragraph.nouns),
    content: paragraph.content,
    wordCount: paragraph.wordCount,
    status: paragraph.status,
    orderIndex: paragraph.orderIndex,
    created_at: paragraph.created_at,
    updated_at: paragraph.updated_at
  }
})
