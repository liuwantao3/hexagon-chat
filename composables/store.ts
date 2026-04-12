import { useStorage } from '@vueuse/core'
import { DEFAULT_ATTACHED_MESSAGES_COUNT, MODEL_FAMILY_SEPARATOR } from '~/config'

export const chatDefaultSettings = useStorage<{
  models: string[]
  attachedMessagesCount: number
  stripThinkSection: boolean
  skills: string[]
}>('chat-default-settings', {
  models: [],
  attachedMessagesCount: DEFAULT_ATTACHED_MESSAGES_COUNT,
  stripThinkSection: false,
  skills: [],
})

// incompatible with old data format
const model = (chatDefaultSettings.value as { model?: string | string[] }).model
if (model) {
  if (Array.isArray(model)) {
    const models = [model.concat().reverse().join(MODEL_FAMILY_SEPARATOR)]
    chatDefaultSettings.value = {
      models,
      attachedMessagesCount: chatDefaultSettings.value.attachedMessagesCount || DEFAULT_ATTACHED_MESSAGES_COUNT,
      stripThinkSection: false,
      skills: [],
    }
  } else {
    chatDefaultSettings.value = {
      models: [],
      attachedMessagesCount: DEFAULT_ATTACHED_MESSAGES_COUNT,
      stripThinkSection: false,
      skills: [],
    }
  }
}
