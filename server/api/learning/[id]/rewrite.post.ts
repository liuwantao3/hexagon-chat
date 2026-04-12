import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'
import { tryParseJson } from '~/composables/utils'

function detectModelFamily(modelName: string): string {
  const modelLower = modelName.toLowerCase()
  if (modelLower.includes('gpt') || modelLower.includes('openai')) return MODEL_FAMILIES.openai
  if (modelLower.includes('claude') || modelLower.includes('anthropic')) return MODEL_FAMILIES.anthropic
  if (modelLower.includes('gemini') || modelLower.includes('google')) return MODEL_FAMILIES.gemini
  if (modelLower.includes('groq')) return MODEL_FAMILIES.groq
  if (modelLower.includes('moonshot')) return MODEL_FAMILIES.moonshot
  if (modelLower.includes('minimax')) return MODEL_FAMILIES.minimax
  if (modelLower.includes('azure')) return MODEL_FAMILIES.azureOpenai
  return 'Ollama'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { 
    id,
    theme, 
    nouns, 
    model, 
    modelFamily,
    maxWords = 100 
  } = body

  const headers = getRequestHeaders(event)
  const keysValue = headers['x-hexagon-chat-keys']
  const keysData = keysValue ? tryParseJson(decodeURIComponent(keysValue), {}) : {}
  
  const keys = {
    ...keysData,
    ollama: {
      ...keysData.ollama,
      endpoint: (keysData.ollama?.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    }
  }
  event.context.keys = keys

  try {
    let modelName = model || 'llama3'
    let family = modelFamily || detectModelFamily(modelName)
    
    if (modelName.includes('/')) {
      modelName = modelName.split('/').pop()!
    }
    
    const llm = createChatModel(modelName, family, event)

    const paragraphPrompt = `Write a short, engaging story or rhyme (under ${maxWords} words) for young English learners using these words:

${nouns.join(', ')}

Requirements:
- Story must naturally incorporate ALL 5 words
- Keep it under ${maxWords} words
- Make it fun and easy to understand for children
- Can be a mini-story, rhyme, or simple description
- Output ONLY the story, no explanations`

    const response = await llm.invoke([
      ['system', 'You are a creative children\'s story writer. Write short, engaging content using the given words.'],
      ['human', paragraphPrompt]
    ])

    let content = typeof response === 'string' ? response : response.content.toString()
    
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    
    const wordCount = content.split(/\s+/).filter(Boolean).length

    return {
      id,
      theme,
      nouns,
      content,
      wordCount
    }
  } catch (error) {
    console.error('Error rewriting paragraph:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: 'Failed to rewrite paragraph'
    }
  }
})
