import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'
import { tryParseJson } from '~/composables/utils'
import prisma from '@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  console.log('Full request body:', JSON.stringify(body))
  
  const { genre, topic, difficulty, length, reference, model, modelFamily, instructionId } = body

  // Convert instructionId to number if it's a valid string
  const parsedInstructionId = instructionId ? parseInt(instructionId, 10) : null

  console.log('Generate story request:', { genre, topic, parsedInstructionId })

  if (!genre || !topic || !difficulty) {
    setResponseStatus(event, 400)
    return {
      status: "error",
      message: "Missing required fields: genre, topic, difficulty"
    }
  }

  // Get keys from header (same as other APIs)
  const headers = getRequestHeaders(event)
  const keysValue = headers['x-hexagon-chat-keys']
  const keysData = keysValue ? tryParseJson(decodeURIComponent(keysValue), {}) : {}
  
  // Set keys on event context with proper structure (matching middleware)
  const keys = {
    ...keysData,
    ollama: {
      ...keysData.ollama,
      endpoint: (keysData.ollama?.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    }
  }
  event.context.keys = keys

  // Fetch instruction if provided
  let instruction = null
  if (parsedInstructionId && !isNaN(parsedInstructionId)) {
    try {
      instruction = await prisma.instruction.findUnique({ where: { id: parsedInstructionId } })
      console.log('Using instruction:', instruction)
    } catch (e) {
      console.warn('Failed to fetch instruction:', e)
    }
  }

  const lengthHint = length === 'short' ? 'A very short story, around 150-200 words.' :
                     length === 'medium' ? 'A short story, around 400-500 words.' :
                     length === 'long' ? 'A medium-length story, around 800-1000 words.' :
                     'A story of appropriate length.'

  const prompt = `You are a creative story writer. Write an English story with the following parameters:
- Genre: ${genre}
- Topic: ${topic}
- Difficulty: ${difficulty}
- Length hint: ${lengthHint}
${reference ? `- Additional instructions: ${reference}` : ''}

Write the story directly without any preamble. Only output the final story with title.`

  try {
    let modelName = model || 'llama3'
    let family = modelFamily || ''
    
    // Strip prefix from model name (e.g., "MiniMax/MiniMax-M2.5" -> "MiniMax-M2.5")
    if (modelName.includes('/')) {
      const parts = modelName.split('/')
      modelName = parts[parts.length - 1]
    }
    
    // If family is not provided or not found in MODEL_FAMILIES, try to detect from model name
    if (!family) {
      const modelLower = modelName.toLowerCase()
      if (modelLower.includes('gpt') || modelLower.includes('openai')) {
        family = 'OpenAI'
      } else if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
        family = 'Anthropic'
      } else if (modelLower.includes('minimax')) {
        family = 'MiniMax'
      } else if (modelLower.includes('moonshot')) {
        family = 'Moonshot'
      } else if (modelLower.includes('gemini') || modelLower.includes('google')) {
        family = 'Gemini'
      } else if (modelLower.includes('groq')) {
        family = 'Groq'
      } else if (modelLower.includes('azure')) {
        family = 'Azure OpenAI'
      }
    }
    
    // If still no family, default to Ollama
    if (!family) {
      family = 'Ollama'
    }
    
    const llm = createChatModel(modelName, family, event)
    
    let systemPrompt = instruction 
      ? `You are a creative story writer. ${instruction.instruction}`
      : 'You are a creative story writer. Generate engaging stories based on the given criteria.'
    
    // Add reference to system prompt if provided
    if (reference) {
      systemPrompt += `\n\nAdditional requirements: ${reference}`
    }
    
    console.log('System prompt:', systemPrompt)
    
    const response = await llm.invoke([
      ['system', systemPrompt],
      ['human', prompt]
    ])

    let content = typeof response === 'string' ? response : response.content
    
    // Strip think tags if present
    content = content.toString().replace(/<think>[\s\S]*?<\/think>/g, '').trim()

    let title = `${genre.charAt(0).toUpperCase() + genre.slice(1)}: ${topic}`
    const titleMatch = content.match(/^#?\s*Title:?\s*(.+)$/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }

    return {
      title,
      content: content.toString(),
      genre,
      topic,
      difficulty,
      length: length || null,
      reference: reference || null
    }
  } catch (error) {
    console.error("Error generating story: ", error)
    setResponseStatus(event, 500)
    return {
      status: "error",
      message: "Failed to generate story"
    }
  }
})
