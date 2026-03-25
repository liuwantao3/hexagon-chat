import { marketplaceService } from '@/server/skills/marketplace'
import { skillLoader } from '@/server/skills'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    url: string
    name: string
  }>(event)

  if (!body.url || !body.name) {
    throw createError({
      statusCode: 400,
      message: 'Missing url or name',
    })
  }

  await skillLoader.loadAll()
  const existingSkill = skillLoader.getSkill(body.name)

  if (existingSkill) {
    console.log(`[Marketplace] Skill "${body.name}" already installed locally`)
    return {
      success: true,
      message: `Skill "${body.name}" is already installed locally`,
      alreadyInstalled: true,
    }
  }

  console.log(`[Marketplace] Installing skill "${body.name}" from ${body.url}`)

  try {
    const result = await marketplaceService.installFromUrl(body.url, body.name)

    if (result.success) {
      return result
    } else {
      throw createError({
        statusCode: 500,
        message: result.message,
      })
    }
  } catch (error: any) {
    console.error('[Marketplace] Install error:', error)
    const message = error?.data?.message || error?.message || 'Failed to install skill'
    throw createError({
      statusCode: error?.data?.statusCode || 500,
      message,
    })
  }
})
