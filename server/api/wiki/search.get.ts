import { defineEventHandler, getQuery } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

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
    console.error('[Wiki Search] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})