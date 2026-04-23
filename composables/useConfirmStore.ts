import { useStorage } from '@vueuse/core'

interface PendingConfirmation {
  id: string
  action: string
  message: string
  details: string
  toolCallId: string
  sessionId: number
  createdAt: number
  response: 'pending' | 'confirmed' | 'denied'
}

const PENDING_CONFIRMATIONS_KEY = 'pending-confirmations'

export const useConfirmStore = () => {
  const pendingConfirmations = useStorage<PendingConfirmation[]>(PENDING_CONFIRMATIONS_KEY, [])

  const addConfirmation = (confirmation: Omit<PendingConfirmation, 'createdAt' | 'response'>) => {
    pendingConfirmations.value.push({
      ...confirmation,
      createdAt: Date.now(),
      response: 'pending'
    })
    
    // Also save to localStorage for server access
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_CONFIRMATIONS_KEY, JSON.stringify(pendingConfirmations.value))
    }
  }

  const getConfirmation = (id: string) => {
    return pendingConfirmations.value.find(c => c.id === id)
  }

  const getPendingForSession = (sessionId: number) => {
    return pendingConfirmations.value.filter(c => c.sessionId === sessionId && c.response === 'pending')
  }

  const respondToConfirmation = (id: string, response: 'confirmed' | 'denied') => {
    const confirmation = pendingConfirmations.value.find(c => c.id === id)
    if (confirmation) {
      confirmation.response = response
      
      // Also update localStorage for server access
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PENDING_CONFIRMATIONS_KEY, JSON.stringify(pendingConfirmations.value))
      }
    }
  }

  const removeConfirmation = (id: string) => {
    pendingConfirmations.value = pendingConfirmations.value.filter(c => c.id !== id)
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_CONFIRMATIONS_KEY, JSON.stringify(pendingConfirmations.value))
    }
  }

  const clearOldConfirmations = (maxAgeMs: number = 5 * 60 * 1000) => {
    const now = Date.now()
    pendingConfirmations.value = pendingConfirmations.value.filter(c => 
      c.response === 'pending' || (now - c.createdAt) < maxAgeMs
    )
  }

  return {
    pendingConfirmations,
    addConfirmation,
    getConfirmation,
    getPendingForSession,
    respondToConfirmation,
    removeConfirmation,
    clearOldConfirmations
  }
}