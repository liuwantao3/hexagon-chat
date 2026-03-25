import { marketplaceService } from '@/server/skills/marketplace'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = String(query.q || '')

  if (!searchQuery) {
    return {
      skills: [],
      message: 'Please provide a search query',
    }
  }

  console.log(`[Marketplace] Searching for: ${searchQuery}`)

  try {
    const skills = await marketplaceService.search(searchQuery)
    console.log(`[Marketplace] Found ${skills.length} skills`)

    return {
      skills,
      count: skills.length,
    }
  } catch (error) {
    console.error('[Marketplace] Search error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to search marketplace',
    })
  }
})
