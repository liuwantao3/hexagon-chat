import { defineEventHandler, getQuery, readBody } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const search = query.q as string | undefined
    const category = query.category as string | undefined
    const limit = query.limit ? Number(query.limit) : 20
    const offset = query.offset ? Number(query.offset) : 0

    try {
      const pages = await wikiService.searchPages({
        userId,
        query: search,
        category,
        limit,
        offset
      })

      return {
        success: true,
        pages,
        count: pages.length
      }
    } catch (error: any) {
      console.error('[Wiki Pages] Error:', error)
      return {
        success: false,
        message: error.message
      }
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { title, slug, content, category, summary, tags } = body

    if (!title || !slug || !content) {
      return {
        success: false,
        message: 'title, slug, and content are required'
      }
    }

    try {
      const page = await wikiService.createOrUpdatePage(userId, {
        title,
        slug,
        content,
        category: category || 'concept',
        summary,
        tags
      })

      await wikiService.log(userId, 'create_page', { pageId: page.id, slug }, `Created page: ${title}`)
      await wikiService.invalidateSearchIndex(userId)

      return {
        success: true,
        page
      }
    } catch (error: any) {
      console.error('[Wiki Pages] Error:', error)
      return {
        success: false,
        message: error.message
      }
    }
  }

  return {
    success: false,
    message: 'Method not allowed'
  }
})