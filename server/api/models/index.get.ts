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
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
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
    try {
      const response = await fetch('https://api.moonshot.cn/v1/models', {
        headers: {
          'Authorization': `Bearer ${keys.moonshot.key}`,
        }
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
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + keys.gemini.key, {
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
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
      }
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error)
    }

    // Fallback to static models if API call fails
    if (!models.some(m => m.details?.family === MODEL_FAMILIES.gemini)) {
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
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${keys.groq.key}`,
        }
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
