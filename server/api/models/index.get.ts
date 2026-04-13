import http from 'node:http'
import https from 'node:https'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { type ModelResponse, type ModelDetails } from 'ollama'
import { MODEL_FAMILIES, OPENAI_GPT_MODELS, ANTHROPIC_MODELS, AZURE_OPENAI_GPT_MODELS, MOONSHOT_MODELS, MINIMAX_MODELS, GEMINI_MODELS, GROQ_MODELS } from '~/config/index'
import { getOllama } from '@/server/utils/ollama'

export interface ModelItem extends Partial<Omit<ModelResponse, 'details'>> {
  details: Partial<ModelDetails> & { family: string }
}

// Add interface for the API response
interface ModelApiResponse {
  data: Array<{
    id: string
    name: string
    created?: number
    description?: string
    // ... other optional fields
  }>
}

type Protocol = 'http:' | 'https:'

const proxyAgentCache = new Map<string, InstanceType<typeof HttpProxyAgent> | InstanceType<typeof HttpsProxyAgent> | InstanceType<typeof SocksProxyAgent>>()

function getProxyAgent(proxyUrl: string, protocol: Protocol) {
  if (proxyAgentCache.has(proxyUrl))
    return proxyAgentCache.get(proxyUrl)!

  proxyAgentCache.clear()

  const agent = proxyUrl.startsWith('http:')
    ? protocol === 'https:' ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl)
    : new SocksProxyAgent(proxyUrl)

  proxyAgentCache.set(proxyUrl, agent)
  return agent
}

async function fetchWithProxy(url: string, proxyUrl: string, options: RequestInit = {}): Promise<Response> {
  const uri = new URL(url)
  const client = uri.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers,
      agent: getProxyAgent(proxyUrl, uri.protocol as Protocol)
    }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        const body = Buffer.concat(chunks)
        const headers: Record<string, string | string[]> = {}
        Object.entries(response.headers).forEach(([key, value]) => {
          if (value) headers[key] = value
        })
        resolve(new Response(body, {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers
        }))
      })
      response.on('error', reject)
    })
    request.on('error', reject)
    request.end()
  })
}

export default defineEventHandler(async (event) => {
  const keys = event.context.keys
  const models: ModelItem[] = []

  const ollama = await getOllama(event)
  if (ollama) {
    const response = await ollama.list()
    models.push(...response.models)
  }

  if (keys.openai?.key) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${keys.openai.key}`,
        }
      })

      if (response.ok) {
        const data = await response.json()
        const openaiModels = data.data
          .filter((model: any) => !model.id.includes('embedding'))
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
          .map((model: any) => model.id)

        openaiModels.forEach((model: string) => {
          models.push({
            name: model,
            details: {
              family: MODEL_FAMILIES.openai
            }
          })
        })
      }
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error)
      // Fallback to static models if API call fails
      OPENAI_GPT_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.openai
          }
        })
      })
    }
  }

  if (keys.azureOpenai?.key && keys.azureOpenai?.endpoint && keys.azureOpenai?.deploymentName) {
    AZURE_OPENAI_GPT_MODELS.forEach((model) => {
      models.push({
        name: model,
        details: {
          family: MODEL_FAMILIES.azureOpenai
        }
      })
    })
  }

  if (keys.anthropic?.key) {
    const config = useRuntimeConfig()
    const proxyUrl = config.modelProxyUrl

    try {
      const anthropicUrl = 'https://api.anthropic.com/v1/models'
      const response = proxyUrl
        ? await fetchWithProxy(anthropicUrl, proxyUrl, {
            headers: {
              'x-api-key': keys.anthropic.key,
              'anthropic-version': '2023-01-01'
            }
          })
        : await fetch(anthropicUrl, {
            headers: {
              'x-api-key': keys.anthropic.key,
              'anthropic-version': '2023-01-01'
            }
          })

      if (response.ok) {
        const data = await response.json()
        data.data?.forEach((model: any) => {
          models.push({
            name: model.id,
            details: {
              family: MODEL_FAMILIES.anthropic
            }
          })
        })
      }
    } catch (error) {
      console.error('Failed to fetch Anthropic models:', error)
    }

    // Fallback to static models if API call fails
    if (!models.some(m => m.details?.family === MODEL_FAMILIES.anthropic)) {
      ANTHROPIC_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.anthropic
          }
        })
      })
    }
  }

  if (keys.moonshot?.key) {
    const config = useRuntimeConfig()
    const proxyUrl = config.modelProxyUrl

    try {
      const moonshotUrl = 'https://api.moonshot.cn/v1/models'
      const response = proxyUrl
        ? await fetchWithProxy(moonshotUrl, proxyUrl, {
            headers: { 'Authorization': `Bearer ${keys.moonshot.key}` }
          })
        : await fetch(moonshotUrl, {
            headers: { 'Authorization': `Bearer ${keys.moonshot.key}` }
          })

      if (response.ok) {
        const data = await response.json()
        data.data?.forEach((model: any) => {
          models.push({
            name: model.id,
            details: {
              family: MODEL_FAMILIES.moonshot
            }
          })
        })
      }
    } catch (error) {
      console.error('Failed to fetch Moonshot models:', error)
    }

    // Fallback to static models if API call fails
    if (!models.some(m => m.details?.family === MODEL_FAMILIES.moonshot)) {
      MOONSHOT_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.moonshot
          }
        })
      })
    }
  }

  if (keys.minimax?.key) {
    // First, use user-provided models
    const userModels = keys.minimax.models || []
    if (userModels.length > 0) {
      console.log('Using user-provided MiniMax models:', userModels)
      userModels.forEach((model: string) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.minimax
          }
        })
      })
    } else {
      // MiniMax doesn't have a /v1/models endpoint, use fallback models directly
      console.log('Using MiniMax fallback models (MiniMax API has no model listing endpoint)')
      MINIMAX_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.minimax
          }
        })
      })
    }
  }

  if (keys.gemini?.key) {
    const config = useRuntimeConfig()
    const proxyUrl = config.modelProxyUrl
    console.log('[Models] Gemini key found, proxy:', proxyUrl || 'none')

    try {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + keys.gemini.key
      console.log('[Models] Fetching Gemini models from:', geminiUrl.substring(0, 80) + '...')
      const response = proxyUrl
        ? await fetchWithProxy(geminiUrl, proxyUrl, {
            headers: { 'Content-Type': 'application/json' }
          })
        : await fetch(geminiUrl, {
            headers: { 'Content-Type': 'application/json' }
          })
      console.log('[Models] Gemini response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        const count = data.models?.length || 0
        console.log('[Models] Gemini models fetched:', count)
        data.models?.forEach((model: any) => {
          if (model.name && (model.supportedGenerationMethods?.includes('generateContent') || model.supportedGenerationMethods?.includes('streamGenerateContent'))) {
            const modelName = model.name.replace('models/', '')
            models.push({
              name: modelName,
              details: {
                family: MODEL_FAMILIES.gemini
              }
            })
          }
        })
        console.log('[Models] Gemini chat models added:', models.filter(m => m.details?.family === MODEL_FAMILIES.gemini).length)
      }
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error)
    }

    // Fallback to static models if API call fails
    if (!models.some(m => m.details?.family === MODEL_FAMILIES.gemini)) {
      console.log('[Models] Using Gemini fallback models')
      GEMINI_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.gemini
          }
        })
      })
    }
  }

  if (keys.groq?.key) {
    const config = useRuntimeConfig()
    const proxyUrl = config.modelProxyUrl

    try {
      const groqUrl = 'https://api.groq.com/openai/v1/models'
      const response = proxyUrl
        ? await fetchWithProxy(groqUrl, proxyUrl, {
            headers: { 'Authorization': `Bearer ${keys.groq.key}` }
          })
        : await fetch(groqUrl, {
            headers: { 'Authorization': `Bearer ${keys.groq.key}` }
          })

      if (response.ok) {
        const data = await response.json()
        data.data?.forEach((model: any) => {
          models.push({
            name: model.id,
            details: {
              family: MODEL_FAMILIES.groq
            }
          })
        })
      }
    } catch (error) {
      console.error('Failed to fetch Groq models:', error)
    }

    // Fallback to static models if API call fails
    if (!models.some(m => m.details?.family === MODEL_FAMILIES.groq)) {
      GROQ_MODELS.forEach((model) => {
        models.push({
          name: model,
          details: {
            family: MODEL_FAMILIES.groq
          }
        })
      })
    }
  }

  if (Array.isArray(keys.custom)) {
    await Promise.all(keys.custom.map(async (item) => {
      if (!item.name || !item.key) return
      
      const hasValidAiType = MODEL_FAMILIES.hasOwnProperty(item.aiType)
      
      // For Azure OpenAI, use predefined models list
      if (item.aiType === 'azureOpenai' && item.endpoint && (item as any).deploymentName) {
        AZURE_OPENAI_GPT_MODELS.forEach(model => {
          models.push({
            name: model,
            details: {
              family: item.name
            }
          })
        })
        return
      }
      
      if (hasValidAiType && item.endpoint && item.key) {
        try {
          // Only attempt API call if modelsEndpoint is provided
          const modelsEndpoint = item.modelsEndpoint || "/models"
          const endpointWithSlash = item.endpoint.endsWith('/') ? item.endpoint : item.endpoint + '/'

          const normalizedModelsEndpoint = modelsEndpoint.startsWith('/') ? modelsEndpoint.substring(1) : modelsEndpoint
          const modelsUrl = new URL(normalizedModelsEndpoint, endpointWithSlash).toString()
          console.log(`Fetching models from ${modelsUrl}`)
          
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${item.key}`,
          }
          
          // Add API version for Azure
          if (item.aiType === 'azureOpenai') {
            headers['api-version'] = '2024-02-15-preview'
          }
          
          const response = await fetch(modelsUrl, { headers })

          if (response.ok) {
            const data: ModelApiResponse = await response.json()
            console.log(`${item.name} models:`, data.data.map(d => d.id || d.name))
            data.data.forEach(model => {
              models.push({
                name: model.id || model.name,
                details: {
                  family: item.name
                }
              })
            })
            return // Skip the fallback if API call succeeds
          } else {
            console.error(`Failed to fetch models for custom endpoint ${item.name}:`, response)
          }
        } catch (error) {
          console.error(`Failed to fetch models for custom endpoint ${item.name}:`, error)
        }

        // Fallback to predefined models list if API call fails or modelsEndpoint not provided
        if (Array.isArray(item.models) && item.models.length > 0) {
          item.models.forEach(model => {
            models.push({
              name: model,
              details: {
                family: item.name
              }
            })
          })
        }
      }
    }))
  }

  return models
})
