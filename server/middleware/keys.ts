import { tryParseJson } from '~/composables/utils'

export interface ChatSettings {
  models: string[]
  attachedMessagesCount: number
}

export interface ContextKeys {
  ollama: {
    endpoint: string
    username: string
    password: string
    chatSettings?: ChatSettings
  },
  openai: {
    key: string
    endpoint: string
    proxy: boolean
    chatSettings?: ChatSettings
  },
  azureOpenai: {
    key: string
    endpoint: string
    deploymentName: string
    proxy: boolean
    chatSettings?: ChatSettings
  },
  anthropic: {
    key: string
    endpoint: string
    proxy: boolean
    chatSettings?: ChatSettings
  },
  moonshot: {
    key: string
    endpoint: string
    chatSettings?: ChatSettings
  },
  minimax: {
    key: string
    endpoint: string
    models: string[]
    chatSettings?: ChatSettings
  },
  gemini: {
    key: string
    endpoint: string
    proxy: boolean
    chatSettings?: ChatSettings
  },
  groq: {
    key: string
    endpoint: string
    proxy: boolean
    chatSettings?: ChatSettings
  },
  /** custom model base on OpenAI API */
  custom: Array<{
    name: string
    aiType: Exclude<keyof ContextKeys, 'custom' | 'moonshot' | 'ollama' | 'minimax'>
    key: string
    endpoint: string
    modelsEndpoint: string | undefined
    proxy: boolean
    models: string[]
    chatSettings?: ChatSettings
  }>
}

export default defineEventHandler((event) => {
  const headers = getRequestHeaders(event)
  const value = headers['x-chat-ollama-keys']
  const data = (value ? tryParseJson(decodeURIComponent(value), {}) : {}) as ContextKeys

  event.context.keys = {
    ...data,
    ollama: {
      ...data.ollama,
      endpoint: (data.ollama?.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    }
  }
})
