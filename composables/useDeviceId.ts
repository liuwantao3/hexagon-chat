const DEVICE_ID_KEY = 'hexagon-device-id'

export function useDeviceId() {
  const deviceId = useState<string | null>('deviceId', () => null)

  function getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return ''
    
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    deviceId.value = id
    return id
  }

  function clearDeviceId() {
    localStorage.removeItem(DEVICE_ID_KEY)
    deviceId.value = null
  }

  onMounted(() => {
    getOrCreateDeviceId()
  })

  return {
    deviceId: computed(() => deviceId.value || getOrCreateDeviceId()),
    getOrCreateDeviceId,
    clearDeviceId
  }
}