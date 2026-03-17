<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
import { getKeysHeader } from '~/utils/settings'
import { useModels } from '~/composables/useModels'

const { chatModels } = useModels()

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

const selectedGenre = ref('fantasy')
const topic = ref('')
const selectedDifficulty = ref('intermediate')
const selectedLength = ref('medium')
const reference = ref('')
const selectedModel = ref('')

const generatedStory = ref<{
  title: string
  content: string
  genre: string
  topic: string
  difficulty: string
  length: string | null
  reference: string | null
} | null>(null)

const savedStories = ref<any[]>([])
const isGenerating = ref(false)
const isSaving = ref(false)
const isLoadingStories = ref(false)
const editingStoryId = ref<number | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isGeneratingVoice = ref(false)
const isSavingVoice = ref(false)
const currentAudioUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentPlayingStoryId = ref<number | null>(null)
let currentAudio: HTMLAudioElement | null = null

const voiceOptions = [
  { value: 'Chinese (Mandarin)_Lyrical_Voice', label: 'Chinese - Lyrical' },
  { value: 'Chinese (Mandarin)_HK_Flight_Attendant', label: 'Chinese - Flight Attendant' },
  { value: 'English_Graceful_Lady', label: 'English - Graceful Lady' },
  { value: 'English_Insightful_Speaker', label: 'English - Insightful Speaker' },
  { value: 'English_radiant_girl', label: 'English - Radiant Girl' },
  { value: 'English_Persuasive_Man', label: 'English - Persuasive Man' }
]

const emotionOptions = [
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'fearful', label: 'Fearful' },
  { value: 'disgusted', label: 'Disgusted' },
  { value: 'surprised', label: 'Surprised' },
  { value: 'calm', label: 'Calm' }
]

const selectedVoice = ref('Chinese (Mandarin)_Lyrical_Voice')
const selectedEmotion = ref('happy')
const voiceSpeed = ref(1)

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
  if (!topic.value.trim() || !selectedModel.value) {
    return
  }

  const modelFamily = chatModels.value.find(m => m.name === selectedModel.value)?.family

  isGenerating.value = true
  try {
    const res = await $fetch<any>('/api/stories/generate', {
      method: 'POST',
      body: {
        genre: selectedGenre.value,
        topic: topic.value,
        difficulty: selectedDifficulty.value,
        length: selectedLength.value,
        model: selectedModel.value,
        family: modelFamily,
        reference: reference.value
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
    currentAudioUrl.value = story.audio_path
  } else {
    currentAudioUrl.value = null
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
    const res = await $fetch<Blob>('/api/audio/speech', {
      method: 'POST',
      body: {
        text: generatedStory.value.content,
        voice_id: selectedVoice.value,
        emotion: selectedEmotion.value,
        speed: voiceSpeed.value,
        format: 'mp3'
      },
      headers: getKeysHeader()
    })

    const blob = new Blob([res], { type: 'audio/mpeg' })
    if (currentAudioUrl.value) {
      URL.revokeObjectURL(currentAudioUrl.value)
    }
    currentAudioUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.error('Failed to generate voice:', e)
    toast.add({ title: 'Failed to generate voice. Please check MiniMax API key.', color: 'red' })
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
      body: { audio_hex: audioHex },
      headers: getKeysHeader()
    })
  }

  generatedStory.value = null
  editingStoryId.value = null
  currentAudioUrl.value = null
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

function clearGeneratedStory() {
  generatedStory.value = null
  editingStoryId.value = null
  currentAudioUrl.value = null
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value = null
  }
}

onMounted(() => {
  loadStories()
})

watch(() => chatModels.value, (newModels) => {
  if (newModels.length > 0 && !selectedModel.value) {
    selectedModel.value = newModels[0].name
  }
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto">
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
                  <label class="block text-xs text-gray-500 mb-1">Emotion</label>
                  <USelect
                    v-model="selectedEmotion"
                    :options="emotionOptions"
                    option-label="label"
                    option-value="value"
                    size="sm"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Speed: {{ voiceSpeed }}</label>
                  <URange v-model="voiceSpeed" :min="0.5" :max="2" :step="0.1" size="sm" />
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
  </div>
</template>
