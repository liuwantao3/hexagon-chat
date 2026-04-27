import type { ChatSession } from './clientDB'
import { useModels } from './useModels'
import { chatDefaultSettings } from './store'
import { useDeviceId } from './useDeviceId'
import { useServerChat } from './useServerChat'

export function useCreateChatSession() {
  const { chatModels, loadModels } = useModels({ immediate: false })
  const { t } = useI18n()
  const toast = useToast()
  const { createSession } = useServerChat()

  return async function createChatSession(params?: {
    title?: string
    models?: string[]
    instructionId?: number
    knowledgeBaseId?: number
  }) {
    await loadModels()
    const models = params?.models || chatDefaultSettings.value.models
    
    if (chatModels.value.length === 0) {
      toast.add({ title: t('chat.noModelFound'), description: t('chat.noModelFoundDesc'), color: 'red' })
    } else {
      const availableModels = models?.filter(m => chatModels.value.some(cm => cm.value === m))
      params = { ...params, models: availableModels }
    }

    const result = await createSession('', {
      model: params?.models?.[0],
      models: params?.models,
      instructionId: params?.instructionId,
      knowledgeBaseId: params?.knowledgeBaseId
    })
    
    return { 
      ...result, 
      attachedMessagesCount: chatDefaultSettings.value.attachedMessagesCount,
      isTop: 0,
      count: 0 
    }
  }
}