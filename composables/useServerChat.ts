import { useDeviceId } from './useDeviceId'

export function useServerChat() {
  const { data } = useAuth()
  const { deviceId } = useDeviceId()

  const userId = computed(() => data.value?.id)
  const anonymousId = computed(() => deviceId.value)

  async function getSessions() {
    const id = userId.value
    const anonId = anonymousId.value
    
    // Always send both userId and anonymousId to support all scenarios
    return await $fetch('/api/chat/sessions', {
      query: { 
        userId: id || undefined, 
        anonymousId: anonId || undefined
      }
    })
  }

  async function createSession(title: string, params?: {
    model?: string
    models?: string[]
    instructionId?: number
    knowledgeBaseId?: number
  }) {
    const id = userId.value
    const anonId = anonymousId.value
    
    const result = await $fetch('/api/chat/sessions', {
      method: 'POST',
      body: {
        userId: id || undefined,
        anonymousId: id ? undefined : (anonId || undefined),
        title,
        ...params
      }
    })
    return result
  }

  async function getSessionMessages(sessionId: number) {
    const id = userId.value
    const anonId = anonymousId.value
    
    return await $fetch(`/api/chat/${sessionId}/messages`, {
      query: { 
        userId: id || undefined,
        anonymousId: anonId || undefined
      }
    })
  }

  async function updateSession(sessionId: number, data: { title?: string, models?: string[] }) {
    return await $fetch(`/api/chat/${sessionId}`, {
      method: 'PUT',
      query: { 
        userId: userId.value || undefined,
        anonymousId: anonymousId.value || undefined
      },
      body: data
    })
  }

  async function deleteSession(sessionId: number) {
    return await $fetch(`/api/chat/${sessionId}`, {
      method: 'DELETE',
      query: { 
        userId: userId.value || undefined,
        anonymousId: anonymousId.value || undefined
      }
    })
  }

  return {
    userId,
    anonymousId,
    getSessions,
    createSession,
    getSessionMessages,
    updateSession,
    deleteSession
  }
}