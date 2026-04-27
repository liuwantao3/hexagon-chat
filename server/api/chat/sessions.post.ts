import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '~/server/utils/prisma'

interface CreateSessionBody {
  userId?: number
  anonymousId?: string
  title: string
  model?: string
  modelFamily?: string
  models?: string[]
  instructionId?: number
  knowledgeBaseId?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateSessionBody>(event)
  const { userId, anonymousId, title, model, modelFamily, models, instructionId, knowledgeBaseId } = body

  if (!userId && !anonymousId) {
    throw createError({
      statusCode: 400,
      message: 'userId or anonymousId is required'
    })
  }

  const now = Date.now()

  try {
    const session = await prisma.chatSession.create({
      data: {
        userId: userId || null,
        anonymousId: anonymousId || null,
        title: title || null,  // Allow null so first message can set title
        createTime: now,
        updateTime: now,
        model: model || null,
        modelFamily: modelFamily || null,
        models: models ? JSON.stringify(models) : null,
        instructionId: instructionId || null,
        knowledgeBaseId: knowledgeBaseId || null,
        attachedMessagesCount: 0,
        isTop: 0
      }
    })

    return {
      id: session.id,
      title: session.title,
      createTime: Number(session.createTime),
      updateTime: Number(session.updateTime),
      model: session.model,
      modelFamily: session.modelFamily
    }
  } catch (error: any) {
    console.error('[Create Session API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to create session: ${error.message}`
    })
  }
})