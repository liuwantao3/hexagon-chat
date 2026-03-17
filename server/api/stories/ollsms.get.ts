import { getOllama } from '@/server/utils/ollama'

export default defineEventHandler(async (event) => {
  try {
    const ollama = await getOllama(event)
    if (ollama) {
      const response = await ollama.list()
      return response.models.map((m: any) => m.name) || []
    }
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error)
  }
  
  return []
})
