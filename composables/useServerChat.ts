import { useDeviceId } from './useDeviceId'
import { $fetchWithAuth } from './fetchWithAuth'

export function useServerChat() {
  const { data } = useAuth()
  const { deviceId } = useDeviceId()

  const userId = computed(() => data.value?.id)
  const anonymousId = computed(() => deviceId.value)

  async function getSessions() {
    const id = userId.value
    const anonId = anonymousId.value

    return await $fetchWithAuth('/api/chat/sessions', {
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

    const result = await $fetchWithAuth('/api/chat/sessions', {
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

  async function getSessionMessages(sessionId: number, params?: { take?: number, cursor?: number, orderBy?: 'asc' | 'desc' }) {
    const id = userId.value
    const anonId = anonymousId.value

    const res = await $fetchWithAuth(`/api/chat/${sessionId}/messages`, {
      query: {
        userId: id || undefined,
        anonymousId: anonId || undefined,
        ...params
      }
    })

    if (res && typeof res === 'object' && 'messages' in res) {
      return (res as any).messages
    }
    return res
  }

  async function updateSession(sessionId: number, data: { title?: string, models?: string[] }) {
    return await $fetchWithAuth(`/api/chat/${sessionId}`, {
      method: 'PUT',
      query: {
        userId: userId.value || undefined,
        anonymousId: anonymousId.value || undefined
      },
      body: data
    })
  }

  async function deleteSession(sessionId: number) {
    return await $fetchWithAuth(`/api/chat/${sessionId}`, {
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