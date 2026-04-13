import { useStorage } from '@vueuse/core'

interface TTSModel {
    id: string
    name: string
    description: string
    provider: string
}

interface ImageModel {
    id: string
    name: string
    description: string
    provider: string
}

interface Voice {
    id: string
    name: string
    provider: string
}

export const MINIMAX_VOICES: Voice[] = [
    { id: 'Chinese (Mandarin)_Lyrical_Voice', name: 'Chinese - Lyrical', provider: 'minimax' },
    { id: 'Chinese (Mandarin)_HK_Flight_Attendant', name: 'Chinese - Flight Attendant', provider: 'minimax' },
    { id: 'English_Graceful_Lady', name: 'English - Graceful Lady', provider: 'minimax' },
    { id: 'English_Insightful_Speaker', name: 'English - Insightful Speaker', provider: 'minimax' },
    { id: 'English_radiant_girl', name: 'English - Radiant Girl', provider: 'minimax' },
    { id: 'English_Persuasive_Man', name: 'English - Persuasive Man', provider: 'minimax' },
    { id: 'male-qn-qingse', name: 'Male - Qingse', provider: 'minimax' },
    { id: 'male-qn-jingying', name: 'Male - Jingying', provider: 'minimax' },
    { id: 'female-yujie', name: 'Female - Yujie', provider: 'minimax' },
    { id: 'female-aixia', name: 'Female - Aixia', provider: 'minimax' },
]

export const GEMINI_VOICES: Voice[] = [
    // Gemini TTS voices
    { id: 'Puck', name: 'Puck (Male)', provider: 'gemini' },
    { id: 'Charon', name: 'Charon (Male)', provider: 'gemini' },
    { id: 'Fenrir', name: 'Fenrir (Male)', provider: 'gemini' },
    { id: 'Lora', name: 'Lora (Female)', provider: 'gemini' },
    { id: 'Sarah', name: 'Sarah (Female)', provider: 'gemini' },
    { id: 'Ruth', name: 'Ruth (Female)', provider: 'gemini' },
    { id: 'Ember', name: 'Ember (Female)', provider: 'gemini' },
    { id: 'Novaa', name: 'Novaa (Female)', provider: 'gemini' },
]

const audioModels = useStorage<TTSModel[]>('audio-models', [])
const imageModels = useStorage<ImageModel[]>('image-models', [])

export function useAudioModels() {
    const loading = ref(false)

    async function loadModels() {
        if (audioModels.value.length > 0) return

        loading.value = true
        try {
            const response = await $fetch<{ tts: TTSModel[], image: ImageModel[] }>('/api/audioModels/', {
                headers: getKeysHeader()
            })
            audioModels.value = response.tts || []
            imageModels.value = response.image || []
        } catch (error) {
            console.error('Failed to load audio models:', error)
        } finally {
            loading.value = false
        }
    }

    const ttsOptions = computed(() => {
        return audioModels.value.map(m => ({
            value: m.id,
            label: `${m.name} (${m.provider})`,
            provider: m.provider,
            description: m.description
        }))
    })

    const imageOptions = computed(() => {
        return imageModels.value.map(m => ({
            value: m.id,
            label: `${m.name} (${m.provider})`,
            provider: m.provider,
            description: m.description
        }))
    })

    function getVoicesByProvider(provider: string) {
        if (provider === 'gemini') {
            return GEMINI_VOICES.map(v => ({ value: v.id, label: v.name }))
        }
        return MINIMAX_VOICES.map(v => ({ value: v.id, label: v.name }))
    }

    function supportsEmotion(provider: string) {
        // Only MiniMax supports emotion
        return provider === 'minimax'
    }

    return {
        audioModels,
        imageModels,
        ttsOptions,
        imageOptions,
        loadModels,
        loading,
        getVoicesByProvider,
        supportsEmotion,
        MINIMAX_VOICES,
        GEMINI_VOICES
    }
}
