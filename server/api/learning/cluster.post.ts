import { createChatModel } from '@/server/utils/models'
import { MODEL_FAMILIES } from '~/config'
import { tryParseJson } from '~/composables/utils'
import { NOUNS_200 } from '@/server/data/nouns200'

interface Cluster {
  theme: string
  nouns: string[]
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

function extractClusters(text: string, validNouns: string[]): Cluster[] {
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const clusters: Cluster[] = []
  
  const parts = cleanText.split(/(?=Theme:|主题:|第[一二三四五六七八九十\d]+组|Cluster \d+:|\d+\.)/i)
  
  let currentTheme = ''
  let currentNouns: string[] = []
  
  for (const part of parts) {
    const lines = part.split('\n').filter(l => l.trim())
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      const themeMatch = trimmed.match(/^(?:Theme:|主题:|第.+?组|Cluster\s*\d+:)\s*(.+)/i) ||
                        trimmed.match(/^(\d+)\.\s*(.+)/)
      if (themeMatch) {
        if (currentTheme && currentNouns.length > 0) {
          clusters.push({ theme: currentTheme.trim(), nouns: [...currentNouns] })
        }
        currentTheme = (themeMatch[2] || themeMatch[1]).trim()
        currentNouns = []
      }
      
      const nounMatch = trimmed.match(/^[-•*]\s*(.+)/) || trimmed.match(/^\d+\.\s*(.+)/)
      if (nounMatch && currentTheme) {
        const noun = nounMatch[1].trim().toLowerCase().replace(/['"]/g, '')
        if (validNouns.includes(noun)) {
          currentNouns.push(noun)
        }
      }
    }
  }
  
  if (currentTheme && currentNouns.length > 0) {
    clusters.push({ theme: currentTheme.trim(), nouns: [...currentNouns] })
  }
  
  return clusters
}

async function generateSemanticClusters(llm: any, allNouns: string[], targetClusters: number): Promise<Cluster[]> {
  const nounsList = allNouns.join(', ')
  
  const promptText = 'You are an educational content organizer.\n\n' +
    'Task: Group the following ' + allNouns.length + ' nouns into ' + targetClusters + ' clusters of 5 nouns each.\n\n' +
    'NOUNS:\n' + nounsList + '\n\n' +
    'IMPORTANT:\n' +
    '- Create EXACTLY ' + targetClusters + ' clusters\n' +
    '- Each cluster must have exactly 5 nouns\n' +
    '- Use semantically related nouns in each cluster (e.g., animals together, food together)\n\n' +
    'OUTPUT FORMAT:\n' +
    'Theme: Animals\n' +
    '- dog\n' +
    '- cat\n' +
    '- bird\n' +
    '- fish\n' +
    '- horse\n\n' +
    'Theme: Food\n' +
    '- apple\n' +
    '- bread\n' +
    '- milk\n' +
    '- cake\n' +
    '- water'

  const response = await llm.invoke([
    ['system', 'You are an educational content organizer. Output ONLY the cluster list in the specified format.'],
    ['human', promptText]
  ])

  const responseText = typeof response === 'string' ? response : response.content.toString()
  const cleanedText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  
  const clusters = extractClusters(cleanedText, allNouns)
  console.log('[Semantic Clustering] LLM returned', clusters.length, 'clusters')
  
  return clusters
}

function generateDifficultyClusters(allNouns: string[], targetClusters: number, nounsPerCluster: number): Cluster[] {
  const easyNouns = ['dog', 'cat', 'bird', 'fish', 'apple', 'banana', 'ball', 'book', 'car', 'bed', 
    'chair', 'table', 'tree', 'flower', 'sun', 'moon', 'star', 'hand', 'foot', 'eye', 
    'nose', 'mouth', 'water', 'milk', 'bread', 'cake', 'house', 'home', 'room', 'door',
    'mother', 'father', 'sister', 'brother', 'friend', 'baby', 'girl', 'boy', 'man', 'woman',
    'day', 'night', 'morning', 'school', 'teacher', 'game', 'toy', 'picture', 'song', 'music',
    'clock', 'phone', 'window', 'wall', 'floor', 'bedroom', 'bathroom', 'kitchen', 'garden', 'yard']

  const hardNouns = allNouns.filter(n => !easyNouns.includes(n))
  const filteredEasy = allNouns.filter(n => easyNouns.includes(n))

  const clusters: Cluster[] = []
  
  const easyPool = [...filteredEasy].sort(() => Math.random() - 0.5)
  const hardPool = [...hardNouns].sort(() => Math.random() - 0.5)

  for (let i = 0; i < targetClusters; i++) {
    const clusterNouns: string[] = []
    
    if (i % 3 === 0) {
      for (let j = 0; j < nounsPerCluster && easyPool.length > 0; j++) {
        clusterNouns.push(easyPool.shift()!)
      }
    } else if (i % 3 === 1) {
      for (let j = 0; j < nounsPerCluster && hardPool.length > 0; j++) {
        clusterNouns.push(hardPool.shift()!)
      }
    } else {
      for (let j = 0; j < nounsPerCluster; j++) {
        if (easyPool.length > 0) clusterNouns.push(easyPool.shift()!)
        else if (hardPool.length > 0) clusterNouns.push(hardPool.shift()!)
      }
    }
    
    if (clusterNouns.length === nounsPerCluster) {
      clusters.push({
        theme: (i % 3 === 0 ? 'Easy: ' : i % 3 === 1 ? 'Challenging: ' : 'Mixed: ') + 'Group ' + (i + 1),
        nouns: clusterNouns
      })
    }
  }

  console.log('[Difficulty Clustering] Generated', clusters.length, 'clusters')
  return clusters
}

function generateRandomClusters(allNouns: string[], targetClusters: number, nounsPerCluster: number): Cluster[] {
  const shuffled = [...allNouns].sort(() => Math.random() - 0.5)
  const clusters: Cluster[] = []
  
  for (let i = 0; i < targetClusters && i * nounsPerCluster < shuffled.length; i++) {
    clusters.push({
      theme: 'Random Group ' + (i + 1),
      nouns: shuffled.slice(i * nounsPerCluster, i * nounsPerCluster + nounsPerCluster)
    })
  }
  
  console.log('[Random Clustering] Generated', clusters.length, 'clusters')
  return clusters
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { 
    numClusters = 40, 
    overlapCount = 2,
    model, 
    modelFamily,
    customNouns,
    strategy = 'semantic'
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

  const allNouns = (customNouns && Array.isArray(customNouns) && customNouns.length > 0) 
    ? [...new Set(customNouns.map((n: string) => n.toLowerCase().trim()))]
    : [...new Set(NOUNS_200)]

  const totalNouns = allNouns.length
  const nounsPerCluster = 5
  const maxOverlapValue = Math.max(1, overlapCount)
  const maxPossibleClusters = Math.floor(totalNouns * maxOverlapValue / nounsPerCluster)
  const targetClusters = Math.min(numClusters, maxPossibleClusters)

  if (targetClusters === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Not enough nouns to create clusters (need at least 5)'
    })
  }

  let clusters: Cluster[] = []

  try {
    if (strategy === 'random') {
      clusters = generateRandomClusters(allNouns, targetClusters, nounsPerCluster)
    } else if (strategy === 'difficulty') {
      clusters = generateDifficultyClusters(allNouns, targetClusters, nounsPerCluster)
    } else {
      let modelName = model || 'llama3'
      let family = modelFamily || detectModelFamily(modelName)
      
      if (modelName.includes('/')) {
        modelName = modelName.split('/').pop()!
      }
      
      const llm = createChatModel(modelName, family, event)
      clusters = await generateSemanticClusters(llm, allNouns, targetClusters)
    }

    if (clusters.length < targetClusters) {
      const nounCounts: Record<string, number> = {}
      clusters.forEach(c => {
        c.nouns.forEach(n => {
          nounCounts[n] = (nounCounts[n] || 0) + 1
        })
      })
      
      let iterations = 0
      while (clusters.length < targetClusters && iterations < 100) {
        iterations++
        const newNouns: string[] = []
        
        const availableNouns = allNouns.filter(n => (nounCounts[n] || 0) < maxOverlapValue)
        
        if (availableNouns.length < nounsPerCluster) break
        
        for (let i = 0; i < nounsPerCluster; i++) {
          const idx = Math.floor(Math.random() * availableNouns.length)
          const noun = availableNouns.splice(idx, 1)[0]
          newNouns.push(noun)
          nounCounts[noun] = (nounCounts[noun] || 0) + 1
        }
        
        clusters.push({
          theme: 'Group ' + (clusters.length + 1),
          nouns: newNouns
        })
      }
    }

    if (clusters.length > targetClusters) {
      clusters = clusters.slice(0, targetClusters)
    }

    const usedNouns = new Set<string>()
    clusters.forEach(c => c.nouns.forEach(n => usedNouns.add(n)))
    
    return {
      success: true,
      totalClusters: clusters.length,
      totalNounsUsed: usedNouns.size,
      totalNouns: allNouns.length,
      coverage: usedNouns.size + '/' + allNouns.length,
      strategy,
      clusters: clusters.map((c, i) => ({ index: i, theme: c.theme, nouns: c.nouns }))
    }
  } catch (error) {
    console.error('Error in clustering:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate clusters: ' + (error as Error).message
    })
  }
})
