<script setup lang="ts">
const { t } = useI18n()
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
    alert(t('stories.generateError'))
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
    alert(t('stories.saveSuccess'))
  } catch (e) {
    console.error('Failed to save story:', e)
    alert(t('stories.saveError'))
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
    alert(t('stories.deleteError'))
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
}

const editingStoryId = ref<number | null>(null)

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
    generatedStory.value = null
    editingStoryId.value = null
    await loadStories()
    alert(t('stories.saveSuccess'))
  } catch (e) {
    console.error('Failed to update story:', e)
    alert(t('stories.saveError'))
  } finally {
    isSaving.value = false
  }
}

function clearGeneratedStory() {
  generatedStory.value = null
  editingStoryId.value = null
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
