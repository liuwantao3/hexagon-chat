import { defineEventHandler } from 'h3'
import { wikiService } from '~/server/services/wiki'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const result = await wikiService.lint(userId)

    return {
      success: true,
      ...result
    }
  } catch (error: any) {
    console.error('[Wiki Lint] Error:', error)
    return {
      success: false,
      message: error.message
    }
  }
})