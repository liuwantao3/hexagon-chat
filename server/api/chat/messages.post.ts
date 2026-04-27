import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  console.log('[Save Message API] Handler called!')
  
  const body = await readBody(event)
  console.log('[Save Message API] Raw body:', body)

  const sessionId = body.sessionId
  const userId = body.userId
  const anonymousId = body.anonymousId
  const { message, startTime, endTime, model, role, canceled, failed, instructionId, knowledgeBaseId, relevantDocs, toolResult, toolCallId, toolName, toolInput, toolOutput, toolCalls } = body

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'sessionId is required'
    })
  }

  console.log('[Save Message] sessionId:', sessionId, 'userId:', userId, 'anonymousId:', anonymousId, 'role:', role)

  try {
    console.log('[Save Message] Creating chat history record...')
    const chatMessage = await prisma.chatHistory.create({
      data: {
        sessionId,
        userId: userId || null,
        anonymousId: anonymousId || null,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        startTime: BigInt(startTime),
        endTime: BigInt(endTime),
        model,
        role,
        canceled: canceled || false,
        failed: failed || false,
        instructionId: instructionId || null,
        knowledgeBaseId: knowledgeBaseId || null,
        relevantDocs: relevantDocs ? JSON.stringify(relevantDocs) : null,
        toolResult: toolResult || false,
        toolCallId: toolCallId || null,
        toolName: toolName || null,
        toolInput: toolInput ? JSON.stringify(toolInput) : null,
        toolOutput: toolOutput || null,
        toolCalls: toolCalls ? JSON.stringify(toolCalls) : null
      }
    })

    console.log('[Save Message] Created message ID:', chatMessage.id)

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        updateTime: BigInt(endTime),
        attachedMessagesCount: { increment: 1 }
      }
    })

    return {
      id: chatMessage.id,
      sessionId: chatMessage.sessionId
    }
  } catch (error: any) {
    console.error('[Save Message API] Error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to save message: ${error.message}`
    })
  }
})