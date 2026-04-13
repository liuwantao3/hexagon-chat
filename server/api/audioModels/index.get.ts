import { defineEventHandler } from 'h3'
import { MINIMAX_TTS_MODELS, GEMINI_TTS_MODELS } from '../audio/speech.post'
import { MINIMAX_IMAGE_MODELS, GEMINI_IMAGE_MODELS } from '../image/generate.post'

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

export default defineEventHandler(async (event) => {
    const keys = event.context.keys
    
    const ttsModels: TTSModel[] = []
    const imageModels: ImageModel[] = []

    // MiniMax models
    if (keys.minimax?.key) {
        ttsModels.push(...MINIMAX_TTS_MODELS.map(m => ({ ...m, provider: 'minimax' })))
        imageModels.push(...MINIMAX_IMAGE_MODELS.map(m => ({ ...m, provider: 'minimax' })))
    }

    // Gemini models
    if (keys.gemini?.key) {
        ttsModels.push(...GEMINI_TTS_MODELS.map(m => ({ ...m, provider: 'gemini' })))
        imageModels.push(...GEMINI_IMAGE_MODELS.map(m => ({ ...m, provider: 'gemini' })))
    }

    return {
        tts: ttsModels,
        image: imageModels
    }
})
