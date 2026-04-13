<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
import { getKeysHeader, loadOllamaInstructions } from '~/utils/settings'
import { useModels } from '~/composables/useModels'
import { useAudioModels } from '~/composables/useAudioModels'
import { useStorage } from '@vueuse/core'

const { chatModels } = useModels()
const { ttsOptions, imageOptions, loadModels, getVoicesByProvider, supportsEmotion } = useAudioModels()

onMounted(() => {
  loadModels()
})

const baseUrl = computed(() => {
  if (process.client) {
    return window.location.origin
  }
  return ''
})

function getImageUrl(path: string) {
  return path.startsWith('http') ? path : `${baseUrl.value}${path}`
}

const genres = computed(() => [
  { value: 'fantasy', label: t('stories.genreList.fantasy') },
  { value: 'scifi', label: t('stories.genreList.scifi') },
  { value: 'mystery', label: t('stories.genreList.mystery') },
  { value: 'romance', label: t('stories.genreList.romance') },
  { value: 'adventure', label: t('stories.genreList.adventure') },
  { value: 'horror', label: t('stories.genreList.horror') },
  { value: 'comedy', label: t('stories.genreList.comedy') },
  { value: 'drama', label: t('stories.genreList.drama') },
  { value: 'fairytale', label: t('stories.genreList.fairytale') },
  { value: 'historical', label: t('stories.genreList.historical') }
])

const difficulties = computed(() => [
  { value: 'beginner', label: t('stories.difficultyList.beginner') },
  { value: 'intermediate', label: t('stories.difficultyList.intermediate') },
  { value: 'advanced', label: t('stories.difficultyList.advanced') }
])

const lengths = computed(() => [
  { value: 'short', label: t('stories.lengthList.short') },
  { value: 'medium', label: t('stories.lengthList.medium') },
  { value: 'long', label: t('stories.lengthList.long') }
])

const selectedGenre = useStorage('story-genre', 'fantasy')
const topic = useStorage('story-topic', '')
const selectedDifficulty = useStorage('story-difficulty', 'intermediate')
const selectedLength = useStorage('story-length', 'medium')
const reference = useStorage('story-reference', '')
const selectedModel = useStorage('story-model', '')
const selectedInstruction = useStorage<number | null>('story-instruction', null)
const instructions = ref<{ id: number; name: string; label: string }[]>([])

const generatedStory = ref<{
  title: string
  content: string
  genre: string
  topic: string
  difficulty: string
  length: string | null
  reference: string | null
} | null>(null)

// Sync to localStorage manually
watch(generatedStory, (newVal) => {
  if (newVal) {
    localStorage.setItem('story-generated', JSON.stringify(newVal))
  } else {
    localStorage.removeItem('story-generated')
  }
}, { deep: true })

// Load from localStorage on mount
onMounted(() => {
  const saved = localStorage.getItem('story-generated')
  if (saved) {
    try {
      generatedStory.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to parse saved story:', e)
    }
  }
})

const editingStoryId = useStorage<number | null>('story-editing-id', null)

const savedStories = ref<any[]>([])
const isGenerating = ref(false)
const isSaving = ref(false)
const isLoadingStories = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const isGeneratingVoice = ref(false)
const isSavingVoice = ref(false)
const currentAudioUrl = useStorage<string | null>('story-audio-url', null)
const currentAudioTimestamps = ref<any[] | null>(null)
const isPlaying = ref(false)
const currentPlayingStoryId = ref<number | null>(null)
let currentAudio: HTMLAudioElement | null = null

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// Voice options are now dynamic based on provider (see line 140)

const emotionOptions = [
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fearful', label: 'Fearful' },
  { value: 'disgusted', label: 'Disgusted' },
  { value: 'surprised', label: 'Surprised' },
  { value: 'calm', label: 'Calm' }
]

// Dynamic voice options based on provider
const currentTtsProvider = computed(() => {
  const modelOption = ttsOptions.value.find(m => m.value === selectedTtsModel.value)
  return modelOption?.provider || 'minimax'
})

const voiceOptions = computed(() => getVoicesByProvider(currentTtsProvider.value))
const showEmotion = computed(() => supportsEmotion(currentTtsProvider.value))

const ttsModelOptions = computed(() => ttsOptions.value.length > 0 ? ttsOptions.value : [
  { value: 'speech-2.8-hd', label: 'speech-2.8-hd (MiniMax)', provider: 'minimax' },
  { value: 'gemini-2.5-flash-preview-tts', label: 'gemini-2.5-flash-preview-tts (Gemini)', provider: 'gemini' }
])

const selectedVoice = useStorage('story-voice', 'Chinese (Mandarin)_Lyrical_Voice')
const selectedEmotion = useStorage('story-emotion', 'happy')
const selectedVoiceSpeed = useStorage('story-voice-speed', 1)
const selectedTtsModel = useStorage('story-tts-model', 'speech-2.8-hd')

// Image generation state
const isGeneratingImage = ref(false)
const isSavingImage = ref(false)
const isImageStopping = ref(false)
const imageAbortController = ref<AbortController | null>(null)
const currentImageUrl = useStorage<string | null>('story-image-url', null)
const selectedImageAspectRatio = useStorage('story-image-aspect-ratio', '1:1')
const selectedImageModel = useStorage('story-image-model', 'image-01')
const selectedImageInstruction = useStorage<number | null>('story-image-instruction', null)
const additionalImageRequirement = useStorage('story-image-requirement', '')

const aspectRatioOptions = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3 (Portrait)' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16 (Vertical)' }
]

const imageModelOptions = computed(() => imageOptions.value.length > 0 ? imageOptions.value : [
  { value: 'image-01', label: 'Image-01 (MiniMax)', provider: 'minimax' },
  { value: 'imagen-3.0-generate-002', label: 'imagen-3.0-generate-002 (Gemini)', provider: 'gemini' }
])

 async function generateImage() {
  if (!generatedStory.value || !generatedStory.value.title) return

  // Create abort controller
  imageAbortController.value = new AbortController()
  const abortSignal = imageAbortController.value.signal
  
  isGeneratingImage.value = true
  isImageStopping.value = false
  try {
    const keys = getKeysHeader()
    const keysData = keys['x-hexagon-chat-keys'] ? JSON.parse(decodeURIComponent(keys['x-hexagon-chat-keys'])) : {}
    
    const selectedModelObj = chatModels.value.find(m => m.value === selectedModel.value)
    const modelFamily = selectedModelObj?.family
    const modelName = selectedModelObj?.name
    console.log('[Image Generation] Selected chat model:', selectedModel.value, 'Family:', modelFamily, 'Name:', modelName)
    console.log('[Image Generation] Selected image model:', selectedImageModel.value)
    
    // Check if stopped
    if (abortSignal.aborted || isImageStopping.value) return
    
    // First, summarize the story
    const summaryPrompt = `Summarize the following story in about 100 words, focusing on the main characters, setting, and key actions that would be important for creating an illustration:\n\n${generatedStory.value.content || ''}`
    
    console.log('[Image Generation] Summarizing story...')
    
    const summaryRes = await $fetch<any>('/api/models/chat', {
      method: 'POST',
      body: {
        model: modelName,
        family: modelFamily,
        messages: [
          { role: 'user', content: summaryPrompt }
        ],
        stream: false
      },
      headers: getKeysHeader(),
      signal: abortSignal
    })
    
    const summary = summaryRes.message.content
    
    // Remove thinking/reflection sections from summary (same regex as ChatMessageItem)
    const regex = /<think>[\s\S]*?<\/think>/gs
    let cleanSummary = summary.replace(regex, '').trim()
    
    console.log('[Image Generation] Story summary:', cleanSummary)
    
    // Build final prompt with summary and instruction
    let prompt = `Create an illustration for a story titled "${generatedStory.value.title}". ${cleanSummary}`
    
    // Include instruction if selected
    const instructionId = selectedImageInstruction.value
    console.log('[Image Generation] Selected instruction ID:', instructionId)
    
    if (instructionId) {
      const selectedInst = instructions.value.find(i => i.id == instructionId)
      console.log('[Image Generation] Selected instruction found:', selectedInst)
      if (selectedInst) {
        prompt = `${selectedInst.instruction}\n\n${prompt}`
      }
    }
    
    // Add additional requirements if provided
    if (additionalImageRequirement.value && additionalImageRequirement.value.trim()) {
      prompt = `${prompt}\n\nAdditional requirements: ${additionalImageRequirement.value.trim()}`
    }
    
    // Check if stopped after summary
    if (abortSignal.aborted || isImageStopping.value) {
      console.log('[Image Generation] Stopped after summary')
      isGeneratingImage.value = false
      return
    }
    
    // Truncate to 1500 characters (API limit)
    if (prompt.length > 1500) {
      prompt = prompt.substring(0, 1450) + '...'
    }
    
    console.log('[Image Generation] Final Prompt:', prompt)
    
    // Determine provider based on selected model
    const selectedImageModelOption = imageModelOptions.value.find(m => m.value === selectedImageModel.value)
    const imageProvider = selectedImageModelOption?.provider || 'minimax'
    
    const res = await $fetch<any>('/api/image/generate', {
      method: 'POST',
      body: {
        prompt,
        aspect_ratio: selectedImageAspectRatio.value,
        model: selectedImageModel.value,
        provider: imageProvider
      },
      headers: {
        'x-hexagon-chat-keys': JSON.stringify({
          minimax: keysData.minimax,
          gemini: keysData.gemini
        })
      },
      signal: abortSignal
    })
    
    const result = JSON.parse(res)
    console.log('[Image Generation] Result:', result)
    if (result.imageUrls && result.imageUrls.length > 0) {
      console.log('[Image Generation] Image URL:', result.imageUrls[0])
      currentImageUrl.value = result.imageUrls[0]
    } else if (result.error) {
      toast.add({ title: result.error, color: 'red' })
    }
  } catch (e: any) {
    if (e.name === 'AbortError' || e.name === 'CancelledError') {
      console.log('[Image Generation] Stopped by user')
      return
    }
    console.error('Failed to generate image:', e)
    toast.add({ title: `Failed to generate image with ${imageProvider}. Check API key.`, color: 'red' })
  } finally {
    isGeneratingImage.value = false
    isImageStopping.value = false
    imageAbortController.value = null
  }
}

function stopImageGeneration() {
  if (imageAbortController.value) {
    isImageStopping.value = true
    imageAbortController.value.abort()
    console.log('[Image Generation] Stop requested')
  }
}

async function saveImageToStory() {
  if (!generatedStory.value || !currentImageUrl.value) return

  let storyId: number

  if (editingStoryId.value) {
    await $fetch(`/api/stories/${editingStoryId.value}`, {
      method: 'PUT',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    storyId = editingStoryId.value
  } else {
    const res = await $fetch<{ id: number }>('/api/stories', {
      method: 'POST',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    storyId = res.id
  }

  if (currentImageUrl.value) {
    const isDataUri = currentImageUrl.value.startsWith('data:')
    if (isDataUri) {
      // Save base64 data URI directly
      await $fetch(`/api/stories/${storyId}/image`, {
        method: 'POST',
        body: { image_url: currentImageUrl.value },
        headers: getKeysHeader()
      })
    } else if (currentImageUrl.value.startsWith('http')) {
      await $fetch(`/api/stories/${storyId}/image`, {
        method: 'POST',
        body: { image_url: currentImageUrl.value },
        headers: getKeysHeader()
      })
    }
  }

  currentImageUrl.value = null
  generatedStory.value = null
  editingStoryId.value = null
  await loadStories()
  toast.add({ title: 'Story saved with image!', color: 'green' })
}

async function deleteImage() {
  if (!editingStoryId.value) return
  if (!confirm('Delete image from this story?')) return

  try {
    await $fetch(`/api/stories/${editingStoryId.value}/image`, {
      method: 'DELETE',
      headers: getKeysHeader()
    })
    currentImageUrl.value = null
    await loadStories()
  } catch (e) {
    console.error('Failed to delete image:', e)
  }
}

function viewImage() {
  if (currentImageUrl.value) {
    window.open(currentImageUrl.value, '_blank')
  }
}

function clearGeneratedStory() {
  generatedStory.value = null
  editingStoryId.value = null
  currentAudioUrl.value = null
  currentImageUrl.value = null
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value = null
  }
}

async function loadStories() {
  isLoadingStories.value = true
  try {
    const res = await $fetch<any[]>('/api/stories', {
      headers: getKeysHeader()
    })
    savedStories.value = res
  } catch (e) {
    console.error('Failed to load stories:', e)
  } finally {
    isLoadingStories.value = false
  }
}

async function generateStory() {
  console.log('Generating story with instruction:', selectedInstruction.value)
  if (!topic.value.trim() || !selectedModel.value) {
    return
  }

  editingStoryId.value = null
  currentAudioUrl.value = null
  currentImageUrl.value = null

  const selectedModelObj = chatModels.value.find(m => m.value === selectedModel.value)
  const modelFamily = selectedModelObj?.family
  const modelName = selectedModelObj?.name

  isGenerating.value = true
  try {
    const res = await $fetch<any>('/api/stories/generate', {
      method: 'POST',
      body: {
        genre: selectedGenre.value,
        topic: topic.value,
        difficulty: selectedDifficulty.value,
        length: selectedLength.value,
        model: modelName,
        family: modelFamily,
        reference: reference.value,
        instructionId: selectedInstruction.value || null
      },
      headers: getKeysHeader()
    })
    generatedStory.value = res
  } catch (e) {
    console.error('Failed to generate story:', e)
    toast.add({ title: t('stories.generateError'), color: 'red' })
  } finally {
    isGenerating.value = false
  }
}

async function saveStory() {
  if (!generatedStory.value) return

  isSaving.value = true
  try {
    await $fetch('/api/stories', {
      method: 'POST',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    generatedStory.value = null
    topic.value = ''
    reference.value = ''
    await loadStories()
    toast.add({ title: t('stories.saveSuccess'), color: 'green' })
  } catch (e) {
    console.error('Failed to save story:', e)
    toast.add({ title: t('stories.saveError'), color: 'red' })
  } finally {
    isSaving.value = false
  }
}

async function deleteStory(id: number) {
  if (!confirm(t('stories.confirmDelete'))) return

  try {
    await $fetch(`/api/stories/${id}`, {
      method: 'DELETE',
      headers: getKeysHeader()
    })
    await loadStories()
  } catch (e) {
    console.error('Failed to delete story:', e)
    toast.add({ title: t('stories.deleteError'), color: 'red' })
  }
}

function editStory(story: any) {
  generatedStory.value = {
    title: story.title,
    content: story.content,
    genre: story.genre,
    topic: story.topic,
    difficulty: story.difficulty,
    length: story.length,
    reference: story.reference
  }
  editingStoryId.value = story.id
  
  if (story.audio_path) {
    const baseUrl = process.client ? window.location.origin : ''
    currentAudioUrl.value = `${baseUrl}${story.audio_path}`
  } else {
    currentAudioUrl.value = null
  }
  
  if (story.image_url) {
    currentImageUrl.value = story.image_url
  } else if (story.image_path) {
    const baseUrl = process.client ? window.location.origin : ''
    currentImageUrl.value = `${baseUrl}${story.image_path}`
  } else {
    currentImageUrl.value = null
  }
}

async function updateStory() {
  if (!generatedStory.value || !editingStoryId.value) return

  isSaving.value = true
  try {
    await $fetch(`/api/stories/${editingStoryId.value}`, {
      method: 'PUT',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    await loadStories()
    toast.add({ title: t('stories.saveSuccess'), color: 'green' })
  } catch (e) {
    console.error('Failed to update story:', e)
    toast.add({ title: t('stories.saveError'), color: 'red' })
  } finally {
    isSaving.value = false
  }
}

async function generateVoice() {
  if (!generatedStory.value || !generatedStory.value.content) return

  isGeneratingVoice.value = true
  try {
    const modelToUse = selectedTtsModel.value
    
    // Determine provider based on selected model
    const selectedModelOption = ttsModelOptions.value.find(m => m.value === modelToUse)
    const ttsProvider = selectedModelOption?.provider || 'minimax'
    
    // MiniMax speech-2.8-hd supports timestamps (async), others use sync endpoint
    const needsTimestamps = ttsProvider === 'minimax' && modelToUse === 'speech-2.8-hd'
    const endpoint = needsTimestamps ? '/api/audio/speech_async' : '/api/audio/speech'
    
    console.log('Using TTS:', endpoint, 'model:', modelToUse, 'provider:', ttsProvider)
    
    let res: any
    
    if (needsTimestamps) {
      // Use async endpoint for timestamps (MiniMax only)
      res = await $fetch<{ audio_hex: string; sentence_timestamps: any[] }>(endpoint, {
        method: 'POST',
        body: {
          text: generatedStory.value.content,
          voice_id: selectedVoice.value,
          emotion: selectedEmotion.value,
          speed: selectedVoiceSpeed.value,
          model: modelToUse,
          format: 'mp3'
        },
        headers: getKeysHeader()
      })
      currentAudioTimestamps.value = res.sentence_timestamps
    } else {
      // Build request body based on provider
      const body: any = {
        text: generatedStory.value.content,
        speed: selectedVoiceSpeed.value,
        model: modelToUse,
        format: 'mp3',
        provider: ttsProvider
      }
      
      // MiniMax-specific parameters
      if (ttsProvider === 'minimax') {
        body.voice_id = selectedVoice.value
        body.emotion = selectedEmotion.value
      } else if (ttsProvider === 'gemini') {
        // Gemini uses voice_name instead
        body.voice_name = selectedVoice.value
      }
      
      // Use sync endpoint for faster response (no timestamps)
      const audioRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getKeysHeader()
        },
        body: JSON.stringify(body)
      })
      
      if (!audioRes.ok) {
        const error = await audioRes.json().catch(() => ({}))
        throw new Error(error.message || 'TTS failed')
      }
      
      const audioBuffer = await audioRes.arrayBuffer()
      const uint8Array = new Uint8Array(audioBuffer)
      const hex = Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')
      res = { audio_hex: hex, sentence_timestamps: [] }
      currentAudioTimestamps.value = null
    }

    const audioBuffer = hexToUint8Array(res.audio_hex)
    // Try to detect format from first bytes
    let audioType = 'audio/wav' // default to wav since Gemini returns PCM/WAV
    if (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) {
      audioType = 'audio/mpeg' // ID3 header
    } else if (audioBuffer[0] === 0xFF && audioBuffer[1] === 0xFB) {
      audioType = 'audio/mpeg' // MP3 sync
    } else if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
      audioType = 'audio/wav' // RIFF/WAV header
    } else if (audioBuffer[0] === 0x66 && audioBuffer[1] === 0x74 && audioBuffer[2] === 0x79 && audioBuffer[3] === 0x70) {
      audioType = 'audio/mp4' // ftyp
    }
    console.log('[Audio] Detected format:', audioType, 'first bytes:', audioBuffer.slice(0,4).join(' '))
    
    const blob = new Blob([audioBuffer], { type: audioType })
    if (currentAudioUrl.value) {
      URL.revokeObjectURL(currentAudioUrl.value)
    }
    currentAudioUrl.value = URL.createObjectURL(blob)
  } catch (e: any) {
    console.error('Failed to generate voice:', e)
    toast.add({ title: 'Failed to generate voice: ' + e.message, color: 'red' })
  } finally {
    isGeneratingVoice.value = false
  }
}

async function saveVoiceToStory() {
  if (!generatedStory.value || !currentAudioUrl.value) return

  let storyId: number

  if (editingStoryId.value) {
    // Update existing story
    await $fetch(`/api/stories/${editingStoryId.value}`, {
      method: 'PUT',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    storyId = editingStoryId.value
  } else {
    // Create new story
    const res = await $fetch<{ id: number }>('/api/stories', {
      method: 'POST',
      body: {
        title: generatedStory.value.title,
        content: generatedStory.value.content,
        genre: generatedStory.value.genre,
        topic: generatedStory.value.topic,
        difficulty: generatedStory.value.difficulty,
        length: generatedStory.value.length,
        reference: generatedStory.value.reference,
        status: 'published'
      },
      headers: getKeysHeader()
    })
    storyId = res.id
  }

  // Only upload audio if it's a blob URL (not already saved)
  if (currentAudioUrl.value.startsWith('blob:')) {
    const response = await fetch(currentAudioUrl.value)
    const audioBlob = await response.blob()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioHex = Array.from(new Uint8Array(arrayBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    await $fetch(`/api/stories/${storyId}/audio`, {
      method: 'POST',
      body: { 
        audio_hex: audioHex,
        sentence_timestamps: currentAudioTimestamps.value
      },
      headers: getKeysHeader()
    })
  }

  currentAudioTimestamps.value = null
  pauseVoice()
  generatedStory.value = null
  editingStoryId.value = null
  currentAudioUrl.value = null
  currentPlayingStoryId.value = null
  await loadStories()
  toast.add({ title: 'Story saved with audio!', color: 'green' })
}

async function deleteVoice() {
  if (!editingStoryId.value) return
  if (!confirm('Delete audio from this story?')) return

  try {
    await $fetch(`/api/stories/${editingStoryId.value}/audio`, {
      method: 'DELETE',
      headers: getKeysHeader()
    })
    currentAudioUrl.value = null
    await loadStories()
  } catch (e) {
    console.error('Failed to delete voice:', e)
  }
}

function playVoice() {
  if (currentAudioUrl.value) {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    
    currentAudio = new Audio(currentAudioUrl.value)
    currentAudio.onended = () => {
      isPlaying.value = false
      currentPlayingStoryId.value = null
      currentAudio = null
    }
    currentAudio.play()
    isPlaying.value = true
    currentPlayingStoryId.value = editingStoryId.value
  }
}

function pauseVoice() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  isPlaying.value = false
  currentPlayingStoryId.value = null
}

function playSavedAudio(story: any) {
  // Stop currently playing audio if any
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
    isPlaying.value = false
    currentPlayingStoryId.value = null
  }
  
  const baseUrl = process.client ? window.location.origin : ''
  currentAudioUrl.value = story.audio_path ? `${baseUrl}${story.audio_path}` : null
  editingStoryId.value = story.id
  setTimeout(() => {
    playVoice()
  }, 200)
}

onMounted(async () => {
  loadStories()
  const loadedInstructions = await loadOllamaInstructions()
  instructions.value = loadedInstructions.map(i => ({ ...i, label: i.name }))
})

watch(() => chatModels.value, (newModels) => {
  if (newModels.length > 0 && !selectedModel.value) {
    selectedModel.value = newModels[0].name
  }
}, { immediate: true })
</script>

<template>
  <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        {{ t('menu.stories') }}
      </h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {{ t('stories.generateTitle') }}
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.model') }}
              </label>
              <USelect
                v-model="selectedModel"
                :options="chatModels"
                option-label="name"
                option-value="name"
                :placeholder="t('common.selectModel')"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.genre') }}
              </label>
              <USelect
                v-model="selectedGenre"
                :options="genres"
                option-label="label"
                option-value="value"
                :placeholder="t('stories.genre')"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.topic') }}
              </label>
              <UInput
                v-model="topic"
                :placeholder="t('stories.topicPlaceholder')"
                class="w-full"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('stories.difficulty') }}
                </label>
                <USelect
                  v-model="selectedDifficulty"
                  :options="difficulties"
                  option-label="label"
                  option-value="value"
                  :placeholder="t('stories.difficulty')"
                  class="w-full"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('stories.length') }}
                </label>
                <USelect
                  v-model="selectedLength"
                  :options="lengths"
                  option-label="label"
                  option-value="value"
                  :placeholder="t('stories.length')"
                  class="w-full"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.reference') }}
              </label>
              <UInput
                v-model="reference"
                :placeholder="t('stories.referencePlaceholder')"
                class="w-full"
              />
            </div>

            <div v-if="instructions.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Instruction
              </label>
              <USelect
                v-model="selectedInstruction"
                :options="instructions"
                option-label="label"
                option-value="id"
                value-attribute="id"
                :by="(a: any, b: any) => a === b"
                :placeholder="'Select instruction (optional)'"
                clearable
                class="w-full"
              />
            </div>

            <UButton
              :loading="isGenerating"
              :disabled="!topic.trim() || !selectedModel"
              class="w-full justify-center"
              @click="generateStory"
            >
              {{ t('stories.generateBtn') }}
            </UButton>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {{ t('stories.generatedTitle') }}
          </h2>

          <div v-if="generatedStory" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.title') }}
              </label>
              <UInput
                v-model="generatedStory.title"
                class="w-full"
              />
            </div>

            <div class="flex gap-2">
              <UBadge color="primary">{{ generatedStory.genre }}</UBadge>
              <UBadge color="secondary">{{ generatedStory.difficulty }}</UBadge>
              <UBadge v-if="generatedStory.length" color="gray">{{ generatedStory.length }}</UBadge>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('stories.content') }}
              </label>
              <UTextarea
                v-model="generatedStory.content"
                :rows="10"
                class="w-full"
              />
            </div>

            <div class="flex gap-2">
              <UButton v-if="editingStoryId" @click="updateStory" :loading="isSaving">
                {{ t('stories.updateBtn') }}
              </UButton>
              <UButton v-else @click="saveStory" :loading="isSaving">
                {{ t('stories.saveBtn') }}
              </UButton>
              <UButton variant="outline" @click="clearGeneratedStory">
                {{ t('stories.clearBtn') }}
              </UButton>
            </div>

            <div class="border-t pt-4 mt-4">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Voice Settings
              </h3>
              
              <div class="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Voice</label>
                  <USelect
                    v-model="selectedVoice"
                    :options="voiceOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">
                    Emotion
                    <span v-if="!showEmotion" class="text-xs text-gray-400">(Gemini not supported)</span>
                  </label>
                  <USelect
                    v-model="selectedEmotion"
                    :options="emotionOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                    :disabled="!showEmotion"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Speed: {{ selectedVoiceSpeed }}</label>
                  <URange v-model="selectedVoiceSpeed" :min="0.5" :max="2" :step="0.1" size="sm" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">TTS Model</label>
                  <USelect
                    v-model="selectedTtsModel"
                    :options="ttsModelOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                  />
                </div>
                <div class="flex items-center pt-4">
                  <span class="text-sm text-gray-500">
                    {{ selectedTtsModel === 'speech-2.8-hd' ? '✓ With timestamps' : '○ No timestamps' }}
                  </span>
                </div>
              </div>

              <div class="flex gap-2">
                <UButton 
                  @click="generateVoice" 
                  :loading="isGeneratingVoice"
                  icon="i-heroicons-speaker-wave-20-solid"
                  size="sm"
                >
                  Generate Voice
                </UButton>

                <template v-if="currentAudioUrl">
                  <UButton 
                    @click="playVoice" 
                    icon="i-heroicons-play-20-solid"
                    size="sm"
                    color="green"
                  >
                    Play
                  </UButton>
                  <UButton 
                    @click="pauseVoice" 
                    icon="i-heroicons-pause-20-solid"
                    size="sm"
                    color="yellow"
                  >
                    Pause
                  </UButton>
                  <UButton 
                    v-if="editingStoryId"
                    @click="deleteVoice" 
                    icon="i-heroicons-trash-20-solid"
                    size="sm"
                    color="error"
                    variant="outline"
                  >
                    Delete
                  </UButton>
                  <UButton 
                    @click="saveVoiceToStory" 
                    :loading="isSavingVoice"
                    icon="i-heroicons-cloud-arrow-up-20-solid"
                    size="sm"
                    color="primary"
                  >
                    Save with Voice
                  </UButton>
                </template>
              </div>

              <audio ref="audioRef" :src="currentAudioUrl || undefined" class="hidden" />
            </div>

            <!-- Image Generation Section -->
            <div class="border-t pt-4 mt-4">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Image Generation
              </h3>
              
              <div class="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Aspect Ratio</label>
                  <USelect
                    v-model="selectedImageAspectRatio"
                    :options="aspectRatioOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Model</label>
                  <USelect
                    v-model="selectedImageModel"
                    :options="imageModelOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Instruction</label>
                  <USelect
                    v-model="selectedImageInstruction"
                    :options="instructions"
                    option-label="label"
                    option-value="id"
                    value-attribute="id"
                    :by="(a: any, b: any) => a === b"
                    size="sm"
                    clearable
                    placeholder="Optional"
                    class="w-full"
                  />
                </div>
              </div>
              
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">Additional Requirements</label>
                <UInput
                  v-model="additionalImageRequirement"
                  placeholder="e.g., Use warm colors, show at sunset..."
                  size="sm"
                  class="w-full"
                />
              </div>

              <div class="flex gap-2">
                <UButton 
                  @click="generateImage" 
                  :loading="isGeneratingImage"
                  :disabled="isImageStopping"
                  icon="i-heroicons-photo-20-solid"
                  size="sm"
                >
                  Generate Image
                </UButton>

                <UButton 
                  v-if="isGeneratingImage"
                  @click="stopImageGeneration" 
                  :loading="isImageStopping"
                  icon="i-heroicons-stop-20-solid"
                  size="sm"
                  color="red"
                >
                  Stop
                </UButton>

                <template v-if="currentImageUrl">
                  <UButton 
                    @click="viewImage" 
                    icon="i-heroicons-eye-20-solid"
                    size="sm"
                    color="green"
                  >
                    View
                  </UButton>
                  <UButton 
                    v-if="editingStoryId"
                    @click="deleteImage" 
                    icon="i-heroicons-trash-20-solid"
                    size="sm"
                    color="error"
                    variant="outline"
                  >
                    Delete
                  </UButton>
                  <UButton 
                    @click="saveImageToStory" 
                    :loading="isSavingImage"
                    icon="i-heroicons-cloud-arrow-up-20-solid"
                    size="sm"
                    color="primary"
                  >
                    Save with Image
                  </UButton>
                </template>
              </div>

              <div v-if="currentImageUrl" class="mt-3">
                <img 
                  :src="currentImageUrl" 
                  alt="Generated image preview" 
                  class="max-w-full h-auto rounded-lg shadow-md max-h-64"
                />
              </div>
            </div>
          </div>

          <div v-else class="text-gray-500 dark:text-gray-400 text-center py-12">
            {{ t('stories.noGeneratedStory') }}
          </div>
        </div>
      </div>

      <div class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          {{ t('stories.savedStories') }}
        </h2>

        <div v-if="isLoadingStories" class="text-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8" />
        </div>

        <div v-else-if="savedStories.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-8">
          {{ t('stories.noSavedStories') }}
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="story in savedStories"
            :key="story.id"
            class="border dark:border-gray-700 rounded-lg p-4"
          >
            <h3 class="font-semibold text-gray-900 dark:text-white truncate">
              {{ story.title }}
            </h3>
            <div class="flex gap-2 mt-2 mb-3">
              <UBadge color="primary" size="xs">{{ story.genre }}</UBadge>
              <UBadge color="secondary" size="xs">{{ story.difficulty }}</UBadge>
              <UBadge v-if="story.length" color="gray" size="xs">{{ story.length }}</UBadge>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {{ story.content }}
            </p>
            <div v-if="story.image_path || story.image_url" class="mt-3">
              <img 
                :src="getImageUrl(story.image_path || story.image_url)" 
                alt="Story illustration" 
                class="w-full h-32 object-cover rounded-lg"
              />
            </div>
            <div class="flex gap-2 mt-4">
              <UButton size="xs" @click="editStory(story)">
                {{ t('stories.editBtn') }}
              </UButton>
              <template v-if="story.audio_path">
                <UButton 
                  v-if="!isPlaying || currentPlayingStoryId !== story.id" 
                  size="xs" 
                  color="green"
                  icon="i-heroicons-speaker-wave-20-solid"
                  @click="playSavedAudio(story)"
                >
                  Play
                </UButton>
                <UButton 
                  v-else
                  size="xs" 
                  color="yellow"
                  icon="i-heroicons-pause-20-solid"
                  @click="pauseVoice"
                >
                  Pause
                </UButton>
              </template>
              <UButton size="xs" variant="outline" color="error" @click="deleteStory(story.id)">
                {{ t('stories.deleteBtn') }}
              </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
