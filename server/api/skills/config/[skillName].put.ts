import prisma from "~/server/utils/prisma"
import { skillLoader } from "~/server/skills"

export default defineEventHandler(async (event) => {
  const skillName = getRouterParam(event, 'skillName')
  
  if (!skillName) {
    throw createError({
      statusCode: 400,
      message: 'Skill name is required'
    })
  }

  const configSchema = skillLoader.getConfigSchema(skillName)
  
  if (!configSchema) {
    throw createError({
      statusCode: 404,
      message: `Config schema not found for skill: ${skillName}`
    })
  }

  const userId = event.context.user?.id
  
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'User not authenticated'
    })
  }

  const body = await readBody(event)
  const config = body.config || {}

  const requiredFields = configSchema.fields.filter(f => f.required)
  for (const field of requiredFields) {
    if (!config[field.key]) {
      throw createError({
        statusCode: 400,
        message: `Required field "${field.label}" is missing`
      })
    }
  }

  await prisma.skillConfig.upsert({
    where: {
      userId_skillName: {
        userId,
        skillName
      }
    },
    update: {
      config: JSON.stringify(config)
    },
    create: {
      userId,
      skillName,
      config: JSON.stringify(config)
    }
  })

  return { success: true }
})