import { defineEventHandler, getRouterParam, getQuery } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    return {
      success: false,
      message: 'Slug is required'
    }
  }

  try {
    const page = await wikiService.getPage(userId, slug)

    if (!page) {
      return {
        success: false,
        message: 'Page not found'
      }
    }

    return {
      success: true,
      page
    }
  } catch (error: any) {
    console.error('[Wiki API] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})