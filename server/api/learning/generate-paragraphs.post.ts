import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'
import { tryParseJson } from '~/composables/utils'

interface Cluster {
  index: number
  theme: string
  nouns: string[]
}

interface LearningParagraph {
  id?: number
  theme: string
  nouns: string[]
  content: string
  wordCount?: number
  status?: string
  tags?: string[]
}

const AUDIENCE_MAP: Record<string, string> = {
  young_children: 'young children (ages 5-8)',
  older_children: 'older children (ages 9-12)',
  teenagers: 'teenagers',
  adult_beginners: 'adult beginners'
}

const GENRE_MAP: Record<string, string> = {
  fairy_tales: 'Fairy Tales',
  adventure: 'Adventure',
  science_nature: 'Science & Nature',
  daily_life: 'Daily Life',
  fables: 'Fables & Legends',
  humorous: 'Humorous Stories',
  poems_rhymes: 'Poems & Rhymes',
  mystery: 'Mystery Stories'
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  story: 'engaging story',
  dialogue: 'dialogue/conversation',
  descriptive: 'descriptive passage',
  howto_story: 'how-to story'
}

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

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { 
    clusters, 
    model, 
    modelFamily,
    maxWordsPerParagraph = 100,
    audience = 'young_children',
    genre = 'adventure',
    contentType = 'story'
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

  if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'clusters array is required'
    })
  }

  const audienceText = AUDIENCE_MAP[audience] || 'children'
  const genreText = GENRE_MAP[genre] || 'Adventure'
  const contentTypeText = CONTENT_TYPE_MAP[contentType] || 'story'

  try {
    let modelName = model || 'llama3'
    let family = modelFamily || detectModelFamily(modelName)
    
    if (modelName.includes('/')) {
      modelName = modelName.split('/').pop()!
    }
    
    const llm = createChatModel(modelName, family, event)

    const paragraphs: LearningParagraph[] = []
    const totalSteps = clusters.length
    let currentStep = 0
    
    for (const cluster of clusters) {
      const paragraphPrompt = 
        'Write a short, engaging ' + contentTypeText + ' for ' + audienceText + '.\n\n' +
        'IMPORTANT WORDS TO USE (MUST include ALL of these):\n' +
        cluster.nouns.join(', ') + '\n\n' +
        'Requirements:\n' +
        '- You MUST naturally incorporate ALL 5 words above\n' +
        '- Keep it under ' + maxWordsPerParagraph + ' words\n' +
        '- Make it fun and easy to understand\n' +
        '- Style: ' + genreText + '\n' +
        '- Output ONLY the ' + contentType + ', no explanations or introductions'

      const paraResponse = await llm.invoke([
        ['system', 'You are a creative writer for English language learning. Write engaging content using the required words. Output ONLY the content, no explanations.'],
        ['human', paragraphPrompt]
      ])

      let content = typeof paraResponse === 'string' ? paraResponse : paraResponse.content.toString()
      content = stripThinkTags(content)
      
      const wordCount = content.split(/\s+/).filter(Boolean).length
      
      paragraphs.push({
        theme: cluster.theme,
        nouns: cluster.nouns,
        content: content.trim(),
        wordCount,
        status: 'generated',
        tags: [audience, genre, contentType]
      })
      
      currentStep++
    }

    const allNounsUsed = new Set(paragraphs.flatMap(p => p.nouns))
    
    return {
      success: true,
      progress: 100,
      totalSteps,
      completedSteps: currentStep,
      totalParagraphs: paragraphs.length,
      totalNounsUsed: allNounsUsed.size,
      coverage: allNounsUsed.size + '/' + allNounsUsed.size,
      paragraphs
    }
  } catch (error) {
    console.error('Error generating paragraphs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate paragraphs'
    })
  }
})
