import { defineEventHandler, readBody } from 'h3'
import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { image, prompt, model: modelId } = body

  if (!image) {
    throw createError({
      statusCode: 400,
      message: 'Image is required'
    })
  }

  const keys = event.context.keys

  try {
    let family = 'openai'
    let model = modelId || 'gpt-4o'

    if (modelId?.includes('anthropic')) {
      family = 'anthropic'
      model = 'claude-3-5-sonnet-20241022'
    } else if (modelId?.includes('gemini')) {
      family = 'gemini'
      model = 'gemini-1.5-pro'
    }

    const llm = createChatModel(model, family, event)

    const defaultPrompt = prompt || 'Describe this image in detail. What do you see?'
    
    const response = await llm.invoke([
      ['user', [{ type: 'image_url', image_url: { url: image } }, defaultPrompt]]
    ])

    return {
      success: true,
      summary: response.content
    }
  } catch (error) {
    console.error('Vision summarization error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to summarize image'
    })
  }
})
