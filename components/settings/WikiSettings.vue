<template>
  <div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-bookmark-square" class="text-2xl text-primary-500" />
        <h2 class="text-lg font-semibold">{{ $t('settings.wiki.title') }}</h2>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="loading" class="text-sm text-gray-500">{{ $t('common.loading') }}</span>
      </div>
    </div>

    <div v-if="!userId" class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <p class="text-sm text-gray-500 dark:text-gray-400">Please sign in to access Wiki settings.</p>
    </div>

    <template v-else>
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div>
          <h3 class="font-medium">{{ $t('settings.wiki.enableWiki') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.wiki.enableWikiDesc') }}</p>
        </div>
        <UToggle v-model="wikiEnabled" :loading="saving" />
      </div>

      <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div>
          <h3 class="font-medium">{{ $t('settings.wiki.autoIngest') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.wiki.autoIngestDesc') }}</p>
        </div>
        <UToggle v-model="autoIngest" :loading="saving" />
      </div>

      <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium">Summarizer Model</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Model used for generating wiki pages from chat sessions</p>
          </div>
          <USelect
            v-model="summarizerModel"
            :options="modelOptions"
            @change="updateSummarizerModel"
            :loading="saving"
            class="w-48"
          />
        </div>
      </div>

      <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.wiki.totalPages') }}</p>
            <p class="text-2xl font-semibold">{{ stats?.totalPages || 0 }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.wiki.lastIngest') }}</p>
            <p class="text-sm font-medium">{{ lastIngestFormatted }}</p>
          </div>
        </div>
      </div>

      <div v-if="stats?.byCategory && Object.keys(stats.byCategory).length > 0" class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h3 class="font-medium mb-3">{{ $t('settings.wiki.byCategory') }}</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge v-for="(count, category) in stats.byCategory" :key="category" color="gray" variant="soft">
            {{ category }}: {{ count }}
          </UBadge>
        </div>
      </div>

      <div class="flex gap-2">
        <UButton color="primary" variant="outline" @click="runLint" :loading="linting">
          <UIcon name="i-heroicons-check-circle" class="mr-1" />
          {{ $t('settings.wiki.runLint') }}
        </UButton>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data: auth } = useAuth()

const userId = computed(() => auth.value?.id)

const loading = ref(false)
const saving = ref(false)
const linting = ref(false)
const error = ref('')
const wikiEnabled = ref(true)
const autoIngest = ref(true)
const summarizerModel = ref('MiniMax-M2.5')
const modelOptions = [
  { label: 'MiniMax-M2.5', value: 'MiniMax-M2.5' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'Moonshot V1 8K', value: 'moonshot-v1-8k' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' }
]
const stats = ref<{
  totalPages: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
} | null>(null)
const lastIngest = ref<Date | null>(null)

const lastIngestFormatted = computed(() => {
  if (!lastIngest.value) return '-'
  const date = new Date(lastIngest.value)
  return date.toLocaleString()
})

async function loadWikiInfo() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetchWithAuth('/api/wiki') as any
    if (data.success) {
      wikiEnabled.value = data.config?.enabled ?? true
      autoIngest.value = data.config?.autoIngest ?? true
      summarizerModel.value = data.config?.summarizerModel ?? 'MiniMax-M2.5'
      stats.value = data.stats
      lastIngest.value = data.config?.lastIngest ? new Date(data.config.lastIngest) : null
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load wiki info'
  } finally {
    loading.value = false
  }
}

async function updateEnabled(enabled: boolean) {
  saving.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/config', {
      method: 'PUT',
      body: { enabled }
    })
    wikiEnabled.value = enabled
  } catch (e: any) {
    error.value = e.message || 'Failed to update settings'
    wikiEnabled.value = !enabled
  } finally {
    saving.value = false
  }
}

async function updateAutoIngest(enabled: boolean) {
  saving.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/config', {
      method: 'PUT',
      body: { autoIngest: enabled }
    })
    autoIngest.value = enabled
  } catch (e: any) {
    error.value = e.message || 'Failed to update settings'
    autoIngest.value = !enabled
  } finally {
    saving.value = false
  }
}

async function updateSummarizerModel() {
  saving.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/config', {
      method: 'PUT',
      body: { summarizerModel: summarizerModel.value }
    })
  } catch (e: any) {
    error.value = e.message || 'Failed to update summarizer model'
  } finally {
    saving.value = false
  }
}

async function runLint() {
  linting.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/lint', { method: 'POST' })
    await loadWikiInfo()
  } catch (e: any) {
    error.value = e.message || 'Failed to run lint'
  } finally {
    linting.value = false
  }
}

watch(wikiEnabled, async (newValue) => {
  if (loading.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/config', {
      method: 'PUT',
      body: { enabled: newValue }
    })
  } catch (e: any) {
    error.value = e.message || 'Failed to update settings'
    wikiEnabled.value = !newValue
  } finally {
    saving.value = false
  }
})

watch(autoIngest, async (newValue) => {
  if (loading.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetchWithAuth('/api/wiki/config', {
      method: 'PUT',
      body: { autoIngest: newValue }
    })
  } catch (e: any) {
    error.value = e.message || 'Failed to update settings'
    autoIngest.value = !newValue
  } finally {
    saving.value = false
  }
})

onMounted(() => {
  loadWikiInfo()
})
</script>