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
  
  let userConfig: Record<string, string | boolean> = {}
  
  if (userId) {
    const dbConfig = await prisma.skillConfig.findUnique({
      where: {
        userId_skillName: {
          userId,
          skillName
        }
      }
    })
    
    if (dbConfig?.config) {
      userConfig = JSON.parse(dbConfig.config)
    }
  }

  return {
    schema: configSchema,
    userConfig
  }
})