import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'
import { tryParseJson } from '~/composables/utils'
import { NOUNS_200 } from '@/server/data/nouns200'

interface Cluster {
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

function extractClusters(text: string): Cluster[] {
  const cleanText = stripThinkTags(text)
  const clusters: Cluster[] = []
  const lines = cleanText.split('\n').filter(l => l.trim())
  
  let currentTheme = ''
  let currentNouns: string[] = []
  
  for (const line of lines) {
    const themeMatch = line.match(/^[\d\-\*]+[\.\)]?\s*(?:[\w\s]+):\s*(.+)/i)
    const nounMatch = line.match(/^\s*[-•*]\s*(.+)/)
    
    if (themeMatch) {
      if (currentTheme && currentNouns.length > 0) {
        clusters.push({ theme: currentTheme.trim(), nouns: [...currentNouns] })
      }
      currentTheme = themeMatch[1].trim()
      currentNouns = []
    } else if (nounMatch) {
      const noun = nounMatch[1].trim().toLowerCase().replace(/['"]/g, '')
      if (NOUNS_200.includes(noun)) {
        currentNouns.push(noun)
      }
    }
  }
  
  if (currentTheme && currentNouns.length > 0) {
    clusters.push({ theme: currentTheme.trim(), nouns: [...currentNouns] })
  }
  
  return clusters
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { 
    numClusters = 40, 
    overlapCount = 2,
    model, 
    modelFamily,
    maxWordsPerParagraph = 100 
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

    const nounsList = NOUNS_200.join(', ')
    
    const clusteringPrompt = `You are an educational content organizer for children's English learning.

Your task: Group the following 200 common English nouns into ${numClusters} semantic clusters. Each cluster should contain 5 nouns that naturally go together thematically.

NOUNS TO CLUSTER:
${nounsList}

Requirements:
1. Each cluster should have exactly 5 nouns from the list above
2. Clusters should be semantically meaningful (e.g., animals, food, household items, nature, body parts)
3. Use ALL 200 nouns - no leftovers
4. For intentional learning reinforcement, include ${overlapCount} overlapping nouns across related clusters

Return format:
Theme: [cluster name]
- [noun1]
- [noun2]
- [noun3]
- [noun4]
- [noun5]

Theme: [cluster name]
- [noun1]
...`

    const clusterResponse = await llm.invoke([
      ['system', 'You are an educational content organizer for children\'s English learning. Group nouns into semantic clusters.'],
      ['human', clusteringPrompt]
    ])

    const clusterText = typeof clusterResponse === 'string' ? clusterResponse : clusterResponse.content.toString()
    let clusters = extractClusters(clusterText)

    if (clusters.length < numClusters * 0.8) {
      const fallbackClusters: Cluster[] = []
      const shuffledNouns = [...NOUNS_200].sort(() => Math.random() - 0.5)
      
      for (let i = 0; i < numClusters && i * 5 < shuffledNouns.length; i++) {
        fallbackClusters.push({
          theme: `Theme ${i + 1}`,
          nouns: shuffledNouns.slice(i * 5, i * 5 + 5)
        })
      }
      clusters = fallbackClusters
    }

    if (clusters.length < numClusters) {
      const needed = numClusters - clusters.length
      const usedNouns = new Set(clusters.flatMap(c => c.nouns))
      const unusedNouns = NOUNS_200.filter(n => !usedNouns.has(n))
      
      for (let i = 0; i < needed && i < unusedNouns.length; i++) {
        const start = i * 5
        clusters.push({
          theme: `Theme ${clusters.length + 1}`,
          nouns: unusedNouns.slice(start, start + 5)
        })
      }
    }

    if (clusters.length > numClusters) {
      clusters = clusters.slice(0, numClusters)
    }

    if (overlapCount > 0 && clusters.length > 1) {
      for (let i = 0; i < clusters.length - 1; i++) {
        const currentCluster = clusters[i]
        const nextCluster = clusters[i + 1]
        
        const overlapNouns = currentCluster.nouns.slice(-overlapCount)
        
        const remainingSlots = 5 - overlapCount
        const newNouns: string[] = []
        
        const usedNouns = new Set([...currentCluster.nouns, ...nextCluster.nouns])
        const pool = NOUNS_200.filter(n => !usedNouns.has(n))
        
        for (let j = 0; j < remainingSlots && j < pool.length; j++) {
          newNouns.push(pool[Math.floor(Math.random() * pool.length)])
        }
        
        nextCluster.nouns = [...overlapNouns, ...newNouns]
      }
    }

    const paragraphs: LearningParagraph[] = []
    const totalSteps = clusters.length + 1
    let currentStep = 1
    
    for (const cluster of clusters) {
      const paragraphPrompt = `Write a short, engaging story or rhyme (under ${maxWordsPerParagraph} words) for young English learners using these words:

${cluster.nouns.join(', ')}

Requirements:
- Story must naturally incorporate ALL 5 words
- Keep it under ${maxWordsPerParagraph} words
- Make it fun and easy to understand for children
- Can be a mini-story, rhyme, or simple description
- Output ONLY the story, no explanations`

      const paraResponse = await llm.invoke([
        ['system', 'You are a creative children\'s story writer. Write short, engaging content using the given words.'],
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
        status: 'generated'
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
      totalNouns: NOUNS_200.length,
      coverage: `${allNounsUsed.size}/${NOUNS_200.length}`,
      clusters: clusters.map((c, i) => ({ index: i, theme: c.theme, nouns: c.nouns })),
      paragraphs
    }
  } catch (error) {
    console.error('Error generating learning materials:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: 'Failed to generate learning materials'
    }
  }
})
