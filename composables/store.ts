import { useStorage } from '@vueuse/core'
import { MODEL_FAMILY_SEPARATOR } from '~/config'

export const chatDefaultSettings = useStorage<{
  models: string[]
  stripThinkSection: boolean
  skills: string[]
  contextWindowSize: number
}>('chat-default-settings', {
  models: [],
  stripThinkSection: false,
  skills: [],
  contextWindowSize: 10,
})

// incompatible with old data format
const model = (chatDefaultSettings.value as { model?: string | string[] }).model
if (model) {
  if (Array.isArray(model)) {
    const models = [model.concat().reverse().join(MODEL_FAMILY_SEPARATOR)]
    chatDefaultSettings.value = {
      models,
      stripThinkSection: false,
      skills: [],
      contextWindowSize: 10,
    }
  } else {
    chatDefaultSettings.value = {
      models: [],
      stripThinkSection: false,
      skills: [],
      contextWindowSize: 10,
    }
  }
}
