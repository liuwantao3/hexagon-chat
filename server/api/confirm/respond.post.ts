import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { confirmId, response } = body
  
  if (!confirmId || !response) {
    throw createError({
      statusCode: 400,
      message: 'Missing confirmId or response'
    })
  }
  
  if (response !== 'confirmed' && response !== 'denied') {
    throw createError({
      statusCode: 400,
      message: 'Invalid response'
    })
  }
  
  console.log('[Confirm API] Response received:', confirmId, response)
  
  // Update the confirm request stored by the chat API
  const confirmRequests = (global as any).confirmRequests || new Map()
  console.log('[Confirm API] Current confirmRequests Map:', confirmRequests)
  console.log('[Confirm API] confirmId exists:', confirmRequests.has(confirmId))
  const request = confirmRequests.get(confirmId)
  
  if (request) {
    request.response = response
    confirmRequests.set(confirmId, request)
    console.log('[Confirm API] Updated confirm request:', confirmId, response)
  } else {
    console.log('[Confirm API] Warning: confirm request not found:', confirmId)
  }
  
  return { success: true, response }
})