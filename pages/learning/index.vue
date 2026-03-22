<script setup lang="ts">
import { useModels, parseModelValue } from '~/composables/useModels'
import { getKeysHeader } from '~/utils/settings'

const toast = useToast()
const { chatModels } = useModels()

const selectedModel = ref('')
const numClusters = ref(40)
const overlapCount = ref(2)
const maxWords = ref(100)

const audienceOptions = [
  { value: 'young_children', label: 'Young Children (5-8)' },
  { value: 'older_children', label: 'Older Children (9-12)' },
  { value: 'teenagers', label: 'Teenagers' },
  { value: 'adult_beginners', label: 'Adult Beginners' }
]

const genreOptions = [
  { value: 'fairy_tales', label: 'Fairy Tales' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'science_nature', label: 'Science & Nature' },
  { value: 'daily_life', label: 'Daily Life' },
  { value: 'fables', label: 'Fables & Legends' },
  { value: 'humorous', label: 'Humorous Stories' },
  { value: 'poems_rhymes', label: 'Poems & Rhymes' },
  { value: 'mystery', label: 'Mystery' }
]

const contentTypeOptions = [
  { value: 'story', label: 'Story' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'howto_story', label: 'How-To Story' }
]

const clusteringStrategyOptions = [
  { value: 'semantic', label: 'Semantic (related words)' },
  { value: 'difficulty', label: 'Difficulty (easy → hard)' },
  { value: 'random', label: 'Random' }
]

const selectedAudience = ref('young_children')
const selectedGenre = ref('adventure')
const selectedContentType = ref('story')
const selectedClusteringStrategy = ref('semantic')

const isGenerating = ref(false)
const isClustering = ref(false)
const generatedParagraphs = ref<any[]>([])
const savedParagraphs = ref<any[]>([])
const coverage = ref('')
const totalParagraphs = ref(0)
const progress = ref(0)
const currentStep = ref('')

const isSaving = ref(false)
const isSavingAll = ref(false)
const isLoadingSaved = ref(false)
const editingId = ref<number | null>(null)
const editingContent = ref('')
const rewritingId = ref<number | null>(null)

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const showSearchResults = ref(false)

const editingClusterIndex = ref<number | null>(null)
const editingClusterTheme = ref('')
const editingClusterNouns = ref('')

const uploadedNouns = ref<string[]>([])
const uploadedFileName = ref('')
const nounSource = ref<'default' | 'upload'>('default')
const isUploading = ref(false)

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  isUploading.value = true
  try {
    const text = await file.text()
    
    let nouns: string[] = []
    
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      nouns = text.split(/[,\n\r]+/)
        .map(n => n.trim().toLowerCase())
        .filter(n => n.length > 0 && /^[a-z\s]+$/.test(n))
    } else if (file.name.endsWith('.json')) {
      const data = JSON.parse(text)
      nouns = Array.isArray(data) ? data : (data.nouns || data.words || data.items || [])
    }
    
    nouns = [...new Set(nouns)].slice(0, 500)
    
    uploadedNouns.value = nouns
    uploadedFileName.value = file.name
    nounSource.value = 'upload'
    
    toast.add({ 
      title: `Loaded ${nouns.length} nouns from ${file.name}`, 
      color: 'green' 
    })
  } catch (e: any) {
    console.error('Failed to parse file:', e)
    toast.add({ title: 'Failed to parse file: ' + e.message, color: 'red' })
  } finally {
    isUploading.value = false
  }
}

function clearUploadedFile() {
  uploadedNouns.value = []
  uploadedFileName.value = ''
  nounSource.value = 'default'
  toast.add({ title: 'Using default 200 nouns', color: 'green' })
}

watch(chatModels, (newModels) => {
  if (newModels.length > 0 && !selectedModel.value) {
    selectedModel.value = newModels[0].value
  }
}, { immediate: true })

onMounted(() => {
  loadSavedParagraphs()
})

async function loadSavedParagraphs() {
  isLoadingSaved.value = true
  try {
    const res = await $fetch<any[]>('/api/learning', {
      headers: getKeysHeader()
    })
    savedParagraphs.value = res
  } catch (e) {
    console.error('Failed to load saved paragraphs:', e)
  } finally {
    isLoadingSaved.value = false
  }
}

async function searchByNoun() {
  if (!searchQuery.value.trim()) {
    toast.add({ title: 'Please enter a noun to search', color: 'yellow' })
    return
  }
  
  isSearching.value = true
  showSearchResults.value = true
  try {
    const res = await $fetch<any[]>(`/api/learning/search?noun=${encodeURIComponent(searchQuery.value)}`, {
      headers: getKeysHeader()
    })
    searchResults.value = res
    if (res.length === 0) {
      toast.add({ title: 'No paragraphs found with this noun', color: 'yellow' })
    }
  } catch (e: any) {
    console.error('Failed to search:', e)
    toast.add({ title: 'Search failed: ' + e.message, color: 'red' })
  } finally {
    isSearching.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
}

async function generateClusters() {
  if (!selectedModel.value) {
    toast.add({ title: 'Please select a model', color: 'red' })
    return
  }

  const { family, name } = parseModelValue(selectedModel.value)

  isClustering.value = true
  progress.value = 0
  currentStep.value = 'Clustering nouns...'
  
  const requestBody: any = {
    numClusters: numClusters.value,
    overlapCount: overlapCount.value,
    model: name,
    modelFamily: family,
    strategy: selectedClusteringStrategy.value
  }
  
  if (nounSource.value === 'upload' && uploadedNouns.value.length > 0) {
    requestBody.customNouns = uploadedNouns.value
  }
  
  try {
    console.log('[Frontend] Sending cluster request:', requestBody)
    const res = await $fetch<any>('/api/learning/cluster', {
      method: 'POST',
      body: requestBody,
      headers: getKeysHeader()
    })
    console.log('[Frontend] Cluster response:', res)

    if (res.success) {
      clusters.value = res.clusters || []
      coverage.value = res.coverage
      totalParagraphs.value = res.totalClusters
      activeTab.value = 'clusters'
      
      let message = `Generated ${res.totalClusters} clusters`
      if (res.totalClusters < numClusters.value) {
        message += ` (limited by ${res.totalNouns} nouns)`
      }
      toast.add({ title: message, color: 'green' })
    } else {
      toast.add({ title: res.error || 'Clustering failed', color: 'red' })
    }
  } catch (e: any) {
    console.error('Failed to cluster:', e)
    console.error('Error details:', e.data || e.response || e)
    toast.add({ title: 'Failed to cluster: ' + (e.data?.message || e.message || 'Unknown error'), color: 'red' })
  } finally {
    isClustering.value = false
    progress.value = 100
    currentStep.value = ''
  }
}

async function generateParagraphsFromClusters() {
  if (clusters.value.length === 0) {
    toast.add({ title: 'No clusters to generate from', color: 'yellow' })
    return
  }

  const { family, name } = parseModelValue(selectedModel.value)

  isGenerating.value = true
  generatedParagraphs.value = []
  progress.value = 0
  currentStep.value = 'Generating paragraphs...'
  
  try {
    const res = await $fetch<any>('/api/learning/generate-paragraphs', {
      method: 'POST',
      body: {
        clusters: clusters.value,
        model: name,
        modelFamily: family,
        maxWordsPerParagraph: maxWords.value,
        audience: selectedAudience.value,
        genre: selectedGenre.value,
        contentType: selectedContentType.value
      },
      headers: getKeysHeader()
    })

    if (res.success) {
      generatedParagraphs.value = res.paragraphs || []
      totalParagraphs.value = res.totalParagraphs
      activeTab.value = 'generated'
      toast.add({ title: `Generated ${res.totalParagraphs} paragraphs`, color: 'green' })
    } else {
      toast.add({ title: res.error || 'Generation failed', color: 'red' })
    }
  } catch (e: any) {
    console.error('Failed to generate paragraphs:', e)
    toast.add({ title: 'Failed to generate: ' + e.message, color: 'red' })
  } finally {
    isGenerating.value = false
    progress.value = 100
    currentStep.value = ''
  }
}

function startEditCluster(cluster: any) {
  editingClusterIndex.value = cluster.index
  editingClusterTheme.value = cluster.theme
  editingClusterNouns.value = cluster.nouns.join(', ')
}

function cancelEditCluster() {
  editingClusterIndex.value = null
  editingClusterTheme.value = ''
  editingClusterNouns.value = ''
}

function saveEditCluster() {
  if (editingClusterIndex.value === null) return
  
  const nounsArray = editingClusterNouns.value
    .split(',')
    .map(n => n.trim().toLowerCase())
    .filter(n => n.length > 0)
    .filter(n => NOUNS_200.includes(n))
  
  if (nounsArray.length !== 5) {
    toast.add({ title: 'Must have exactly 5 valid nouns from the list', color: 'yellow' })
    return
  }
  
  const cluster = clusters.value.find(c => c.index === editingClusterIndex.value)
  if (cluster) {
    cluster.theme = editingClusterTheme.value
    cluster.nouns = nounsArray
  }
  
  cancelEditCluster()
  toast.add({ title: 'Cluster updated', color: 'green' })
}

function deleteCluster(index: number) {
  if (!confirm('Delete this cluster?')) return
  clusters.value = clusters.value.filter(c => c.index !== index)
  clusters.value.forEach((c, i) => c.index = i)
  toast.add({ title: 'Cluster deleted', color: 'green' })
}

function resetGeneration() {
  clusters.value = []
  generatedParagraphs.value = []
  activeTab.value = 'generated'
}

async function saveParagraph(paragraph: any, index: number) {
  isSaving.value = true
  try {
    const res = await $fetch<any>('/api/learning', {
      method: 'POST',
      body: {
        id: paragraph.id,
        theme: paragraph.theme,
        nouns: paragraph.nouns,
        content: paragraph.content,
        status: 'saved',
        orderIndex: index
      },
      headers: getKeysHeader()
    })
    
    generatedParagraphs.value[index] = { ...generatedParagraphs.value[index], id: res.id }
    toast.add({ title: 'Paragraph saved', color: 'green' })
    await loadSavedParagraphs()
  } catch (e: any) {
    console.error('Failed to save:', e)
    toast.add({ title: 'Failed to save: ' + e.message, color: 'red' })
  } finally {
    isSaving.value = false
  }
}

async function saveAllParagraphs() {
  if (generatedParagraphs.value.length === 0) return
  
  isSavingAll.value = true
  try {
    const res = await $fetch<any>('/api/learning/batch', {
      method: 'POST',
      body: {
        paragraphs: generatedParagraphs.value
      },
      headers: getKeysHeader()
    })
    
    if (res.success) {
      generatedParagraphs.value = res.paragraphs
      toast.add({ title: `Saved ${res.saved} paragraphs`, color: 'green' })
      await loadSavedParagraphs()
    }
  } catch (e: any) {
    console.error('Failed to save all:', e)
    toast.add({ title: 'Failed to save all: ' + e.message, color: 'red' })
  } finally {
    isSavingAll.value = false
  }
}

async function deleteParagraph(id: number, source: 'generated' | 'saved') {
  if (!confirm('Delete this paragraph?')) return
  
  try {
    await $fetch(`/api/learning/${id}`, {
      method: 'DELETE',
      headers: getKeysHeader()
    })
    
    if (source === 'generated') {
      const idx = generatedParagraphs.value.findIndex(p => p.id === id)
      if (idx !== -1) generatedParagraphs.value.splice(idx, 1)
    } else {
      await loadSavedParagraphs()
    }
    
    toast.add({ title: 'Paragraph deleted', color: 'green' })
  } catch (e: any) {
    console.error('Failed to delete:', e)
    toast.add({ title: 'Failed to delete', color: 'red' })
  }
}

function startEdit(paragraph: any) {
  editingId.value = paragraph.id
  editingContent.value = paragraph.content
}

function cancelEdit() {
  editingId.value = null
  editingContent.value = ''
}

function saveEdit(paragraph: any) {
  const idx = generatedParagraphs.value.findIndex(p => p.id === paragraph.id)
  if (idx !== -1) {
    generatedParagraphs.value[idx].content = editingContent.value
    generatedParagraphs.value[idx].wordCount = editingContent.value.split(/\s+/).filter(Boolean).length
  } else {
    const savedIdx = savedParagraphs.value.findIndex(p => p.id === paragraph.id)
    if (savedIdx !== -1) {
      savedParagraphs.value[savedIdx].content = editingContent.value
      savedParagraphs.value[savedIdx].wordCount = editingContent.value.split(/\s+/).filter(Boolean).length
    }
  }
  cancelEdit()
}

async function rewriteParagraph(paragraph: any) {
  const { family, name } = parseModelValue(selectedModel.value)
  
  rewritingId.value = paragraph.id
  try {
    const res = await $fetch<any>(`/api/learning/${paragraph.id}/rewrite`, {
      method: 'POST',
      body: {
        id: paragraph.id,
        theme: paragraph.theme,
        nouns: paragraph.nouns,
        model: name,
        modelFamily: family,
        maxWords: maxWords.value
      },
      headers: getKeysHeader()
    })
    
    if (res.content) {
      const idx = generatedParagraphs.value.findIndex(p => p.id === paragraph.id)
      if (idx !== -1) {
        generatedParagraphs.value[idx].content = res.content
        generatedParagraphs.value[idx].wordCount = res.wordCount
      } else {
        const savedIdx = savedParagraphs.value.findIndex(p => p.id === paragraph.id)
        if (savedIdx !== -1) {
          savedParagraphs.value[savedIdx].content = res.content
          savedParagraphs.value[savedIdx].wordCount = res.wordCount
        }
      }
      toast.add({ title: 'Paragraph rewritten', color: 'green' })
    }
  } catch (e: any) {
    console.error('Failed to rewrite:', e)
    toast.add({ title: 'Failed to rewrite: ' + e.message, color: 'red' })
  } finally {
    rewritingId.value = null
  }
}

function downloadJson() {
  const allParagraphs = [...generatedParagraphs.value, ...savedParagraphs.value]
  if (allParagraphs.length === 0) return
  
  const data = {
    generatedAt: new Date().toISOString(),
    config: {
      numClusters: numClusters.value,
      overlapCount: overlapCount.value,
      maxWordsPerParagraph: maxWords.value
    },
    coverage: coverage.value,
    totalParagraphs: totalParagraphs.value,
    paragraphs: allParagraphs
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `english-learning-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied to clipboard', color: 'green', timeout: 1500 })
}

const activeTab = ref<'generated' | 'saved' | 'clusters'>('generated')
const clusters = ref<any[]>([])

function formatTag(tag: string): string {
  const tagLabels: Record<string, string> = {
    young_children: 'Young Kids',
    older_children: 'Older Kids',
    teenagers: 'Teen',
    adult_beginners: 'Adult',
    fairy_tales: 'Fairy Tales',
    adventure: 'Adventure',
    science_nature: 'Science',
    daily_life: 'Daily Life',
    fables: 'Fables',
    humorous: 'Humorous',
    poems_rhymes: 'Rhymes',
    mystery: 'Mystery',
    story: 'Story',
    dialogue: 'Dialogue',
    descriptive: 'Descriptive',
    howto_story: 'How-To'
  }
  return tagLabels[tag] || tag
}

function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    young_children: 'pink',
    older_children: 'purple',
    teenagers: 'violet',
    adult_beginners: 'indigo',
    fairy_tales: 'yellow',
    adventure: 'orange',
    science_nature: 'green',
    daily_life: 'cyan',
    fables: 'amber',
    humorous: 'lime',
    poems_rhymes: 'teal',
    mystery: 'gray',
    story: 'blue',
    dialogue: 'emerald',
    descriptive: 'sky',
    howto_story: 'rose'
  }
  return colors[tag] || 'gray'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        English Learning Materials Generator
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-8">
        Generate children's English learning paragraphs from 200 common nouns
      </p>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            Settings
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <USelect
                v-model="selectedModel"
                :options="chatModels"
                option-label="name"
                option-value="value"
                placeholder="Select a model"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Noun Source
              </label>
              <div class="space-y-2">
                <div
                  @click="nounSource = 'default'"
                  :class="[
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    nounSource === 'default'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  ]"
                >
                  <div :class="[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    nounSource === 'default' ? 'border-primary' : 'border-gray-400'
                  ]">
                    <div v-if="nounSource === 'default'" class="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <span class="text-sm">Use default 200 common nouns</span>
                </div>
                <div
                  @click="nounSource = 'upload'"
                  :class="[
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    nounSource === 'upload'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  ]"
                >
                  <div :class="[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    nounSource === 'upload' ? 'border-primary' : 'border-gray-400'
                  ]">
                    <div v-if="nounSource === 'upload'" class="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <span class="text-sm">Upload custom noun list</span>
                </div>
                <div v-if="nounSource === 'upload'" class="mt-2">
                  <input
                    type="file"
                    accept=".txt,.csv,.json"
                    @change="handleFileUpload"
                    class="hidden"
                    id="noun-file-upload"
                  />
                  <label
                    for="noun-file-upload"
                    class="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    :class="{ 'border-primary bg-primary/5': isUploading }"
                  >
                    <UIcon name="i-heroicons-document-arrow-up" class="h-5 w-5 text-gray-400" />
                    <span class="text-sm text-gray-600 dark:text-gray-400">
                      {{ uploadedFileName || 'Click to upload' }}
                    </span>
                  </label>
                  <p class="text-xs text-gray-500 mt-1">
                    Supports .txt (one noun per line), .csv, or .json
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ uploadedNouns.length > 0 ? `${uploadedNouns.length} nouns loaded` : 'No file loaded' }}
                  </p>
                  <UButton
                    v-if="uploadedFileName"
                    size="xs"
                    variant="ghost"
                    class="mt-1"
                    @click="clearUploadedFile"
                  >
                    Clear file
                  </UButton>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Paragraphs: {{ numClusters }}
              </label>
              <URange 
                v-model="numClusters" 
                :min="10" 
                :max="100" 
                :step="5"
                class="mt-2"
              />
              <p class="text-xs text-gray-500 mt-1">More paragraphs = more overlap = more practice</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Overlap Count: {{ overlapCount }}
              </label>
              <URange 
                v-model="overlapCount" 
                :min="0" 
                :max="5" 
                :step="1"
                class="mt-2"
              />
              <p class="text-xs text-gray-500 mt-1">Nouns shared between adjacent paragraphs</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clustering Strategy
              </label>
              <USelect
                v-model="selectedClusteringStrategy"
                :options="clusteringStrategyOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
              <p class="text-xs text-gray-500 mt-1">
                {{ selectedClusteringStrategy === 'semantic' ? 'Group related nouns together' : 
                   selectedClusteringStrategy === 'difficulty' ? 'Mix easy and challenging words' : 
                   'Random groupings for variety' }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Words per Paragraph: {{ maxWords }}
              </label>
              <URange 
                v-model="maxWords" 
                :min="50" 
                :max="200" 
                :step="10"
                class="mt-2"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Audience
              </label>
              <USelect
                v-model="selectedAudience"
                :options="audienceOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Genre / Theme
              </label>
              <USelect
                v-model="selectedGenre"
                :options="genreOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content Type
              </label>
              <USelect
                v-model="selectedContentType"
                :options="contentTypeOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <UButton
              :loading="isClustering"
              :disabled="!selectedModel"
              class="w-full justify-center"
              @click="generateClusters"
            >
              <template #leading>
                <UIcon name="i-heroicons-squares-2x2" />
              </template>
              Step 1: Generate Clusters
            </UButton>

            <div v-if="clusters.length > 0" class="space-y-2">
              <UButton
                :loading="isGenerating"
                :disabled="!selectedModel || clusters.length === 0"
                class="w-full justify-center"
                color="green"
                @click="generateParagraphsFromClusters"
              >
                <template #leading>
                  <UIcon name="i-heroicons-sparkles" />
                </template>
                Step 2: Generate Paragraphs
              </UButton>
              
              <UButton
                variant="outline"
                class="w-full justify-center"
                @click="resetGeneration"
              >
                Start Over
              </UButton>
            </div>

            <div v-if="isGenerating || isClustering" class="space-y-2">
              <UProgress :value="progress" size="sm" color="primary" />
              <p class="text-xs text-gray-500 text-center">{{ currentStep }}</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div class="flex gap-2">
              <UInput
                v-model="searchQuery"
                placeholder="Search by noun (e.g., dog, apple, house)"
                class="flex-1"
                @keyup.enter="searchByNoun"
              >
                <template #leading>
                  <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
                </template>
              </UInput>
              <UButton
                @click="searchByNoun"
                :loading="isSearching"
                icon="i-heroicons-magnifying-glass"
              >
                Search
              </UButton>
              <UButton
                v-if="showSearchResults"
                @click="clearSearch"
                variant="outline"
                icon="i-heroicons-x-mark"
              >
                Clear
              </UButton>
            </div>
          </div>

          <div v-if="showSearchResults" class="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div class="flex border-b dark:border-gray-700 px-4 py-2">
              <span class="text-sm font-medium text-primary">
                Search Results: {{ searchResults.length }} paragraphs found
              </span>
            </div>
          </div>

          <div v-if="!showSearchResults" class="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div class="flex border-b dark:border-gray-700">
              <button
                @click="activeTab = 'generated'"
                :class="[
                  'px-6 py-3 text-sm font-medium transition-colors',
                  activeTab === 'generated'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                Paragraphs ({{ generatedParagraphs.length }})
              </button>
              <button
                @click="activeTab = 'clusters'"
                :class="[
                  'px-6 py-3 text-sm font-medium transition-colors',
                  activeTab === 'clusters'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                Clusters ({{ clusters.length }})
              </button>
              <button
                @click="activeTab = 'saved'"
                :class="[
                  'px-6 py-3 text-sm font-medium transition-colors',
                  activeTab === 'saved'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                Saved ({{ savedParagraphs.length }})
              </button>
            </div>
          </div>

          <div v-if="generatedParagraphs.length > 0 && activeTab === 'generated'" 
               class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div class="flex items-center gap-3">
                <UBadge color="primary" size="lg">{{ totalParagraphs }} paragraphs</UBadge>
                <UBadge v-if="coverage" color="green" size="lg">Coverage: {{ coverage }}</UBadge>
              </div>
              <div class="flex gap-2">
                <UButton
                  @click="saveAllParagraphs"
                  :loading="isSavingAll"
                  icon="i-heroicons-cloud-arrow-up"
                  size="sm"
                  color="primary"
                >
                  Save All
                </UButton>
                <UButton
                  @click="downloadJson"
                  icon="i-heroicons-download"
                  size="sm"
                  variant="outline"
                >
                  Download
                </UButton>
              </div>
            </div>
          </div>

          <div v-if="generatedParagraphs.length === 0 && !isGenerating && activeTab === 'generated'" 
               class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <UIcon name="i-heroicons-document-text" class="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p class="text-gray-500 dark:text-gray-400">
              Click "Generate" to create learning materials
            </p>
          </div>

          <div v-if="isLoadingSaved && activeTab === 'saved'" class="text-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8 mx-auto text-gray-400" />
          </div>

          <div v-if="savedParagraphs.length === 0 && !isLoadingSaved && activeTab === 'saved'" 
               class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <UIcon name="i-heroicons-folder-open" class="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p class="text-gray-500 dark:text-gray-400">
              No saved paragraphs yet. Generate and save some!
            </p>
          </div>

          <TransitionGroup v-if="showSearchResults" name="fade" tag="div" class="space-y-4">
            <div
              v-for="(para, index) in searchResults"
              :key="para.id"
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="font-semibold text-gray-900 dark:text-white">
                      {{ para.theme || `Paragraph ${index + 1}` }}
                    </h3>
                    <UBadge color="purple" size="xs">Search Result</UBadge>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="noun in para.nouns"
                      :key="noun"
                      :color="noun.toLowerCase().includes(searchQuery.toLowerCase()) ? 'primary' : 'blue'"
                      size="sm"
                      variant="soft"
                    >
                      {{ noun }}
                    </UBadge>
                  </div>
                </div>
                <div class="flex gap-1 ml-2">
                  <UButton
                    @click="copyToClipboard(para.content)"
                    icon="i-heroicons-clipboard"
                    size="xs"
                    variant="ghost"
                    title="Copy"
                  />
                </div>
              </div>

              <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {{ para.content }}
              </p>
              <div class="flex items-center justify-between mt-3">
                <p class="text-xs text-gray-400">
                  {{ para.wordCount }} words
                </p>
                <UButton
                  @click="copyToClipboard(para.content)"
                  icon="i-heroicons-clipboard"
                  size="xs"
                  variant="outline"
                >
                  Copy
                </UButton>
              </div>
            </div>
          </TransitionGroup>

          <div v-else-if="activeTab === 'clusters'" class="space-y-4">
            <div v-if="clusters.length === 0" 
                 class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <UIcon name="i-heroicons-squares-2x2" class="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p class="text-gray-500 dark:text-gray-400">
                Click "Step 1: Generate Clusters" to create noun clusters
              </p>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Each cluster contains 5 nouns. Adjacent clusters share {{ overlapCount }} noun(s) for learning reinforcement.
                Edit clusters by clicking the pencil icon.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="cluster in clusters"
                :key="cluster.index"
                class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
              >
                <div v-if="editingClusterIndex === cluster.index" class="space-y-3">
                  <UInput
                    v-model="editingClusterTheme"
                    label="Theme"
                    size="sm"
                  />
                  <UTextarea
                    v-model="editingClusterNouns"
                    label="Nouns (comma separated, 5 nouns)"
                    :rows="2"
                    size="sm"
                    placeholder="dog, cat, bird, fish, horse"
                  />
                  <div class="flex gap-2">
                    <UButton size="xs" color="primary" @click="saveEditCluster">
                      Save
                    </UButton>
                    <UButton size="xs" variant="outline" @click="cancelEditCluster">
                      Cancel
                    </UButton>
                  </div>
                </div>
                
                <div v-else>
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-medium text-gray-900 dark:text-white text-sm">
                      {{ cluster.theme || `Cluster ${cluster.index + 1}` }}
                    </h4>
                    <div class="flex items-center gap-1">
                      <span class="text-xs text-gray-400 mr-2">#{{ cluster.index + 1 }}</span>
                      <UButton
                        @click="startEditCluster(cluster)"
                        icon="i-heroicons-pencil"
                        size="xs"
                        variant="ghost"
                      />
                      <UButton
                        @click="deleteCluster(cluster.index)"
                        icon="i-heroicons-trash"
                        size="xs"
                        variant="ghost"
                        color="error"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="noun in cluster.nouns"
                      :key="noun"
                      color="blue"
                      size="sm"
                      variant="soft"
                    >
                      {{ noun }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TransitionGroup v-else-if="activeTab !== 'clusters'" name="fade" tag="div" class="space-y-4">
            <div
              v-for="(para, index) in (activeTab === 'generated' ? generatedParagraphs : savedParagraphs)"
              :key="para.id || `new-${index}`"
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="font-semibold text-gray-900 dark:text-white">
                      {{ para.theme || `Paragraph ${index + 1}` }}
                    </h3>
                    <UBadge v-if="para.id && savedParagraphs.find(p => p.id === para.id)" color="green" size="xs">
                      Saved
                    </UBadge>
                  </div>
                  <div class="flex flex-wrap gap-1 mb-2">
                    <UBadge
                      v-for="noun in para.nouns"
                      :key="noun"
                      color="blue"
                      size="sm"
                      variant="soft"
                    >
                      {{ noun }}
                    </UBadge>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="tag in para.tags"
                      :key="tag"
                      :color="getTagColor(tag)"
                      size="xs"
                      variant="subtle"
                    >
                      {{ formatTag(tag) }}
                    </UBadge>
                  </div>
                </div>
                <div class="flex gap-1 ml-2">
                  <UButton
                    @click="copyToClipboard(para.content)"
                    icon="i-heroicons-clipboard"
                    size="xs"
                    variant="ghost"
                    title="Copy"
                  />
                </div>
              </div>

              <div v-if="editingId === para.id" class="space-y-2">
                <UTextarea
                  v-model="editingContent"
                  :rows="5"
                  class="w-full"
                />
                <div class="flex gap-2">
                  <UButton size="xs" color="primary" @click="saveEdit(para)">
                    Save
                  </UButton>
                  <UButton size="xs" variant="outline" @click="cancelEdit">
                    Cancel
                  </UButton>
                </div>
              </div>

              <div v-else>
                <p class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {{ para.content }}
                </p>
                <div class="flex items-center justify-between mt-3">
                  <p class="text-xs text-gray-400">
                    {{ para.wordCount || para.content.split(/\s+/).filter(Boolean).length }} words
                  </p>
                  <div class="flex gap-1">
                    <UButton
                      @click="startEdit(para)"
                      icon="i-heroicons-pencil"
                      size="xs"
                      variant="ghost"
                      title="Edit"
                    />
                    <UButton
                      @click="rewriteParagraph(para)"
                      :loading="rewritingId === para.id"
                      icon="i-heroicons-arrow-path"
                      size="xs"
                      variant="ghost"
                      title="Rewrite"
                    />
                    <UButton
                      v-if="!para.id || !savedParagraphs.find(p => p.id === para.id)"
                      @click="saveParagraph(para, index)"
                      :loading="isSaving"
                      icon="i-heroicons-cloud-arrow-up"
                      size="xs"
                      variant="ghost"
                      color="primary"
                      title="Save"
                    />
                    <UButton
                      v-if="para.id"
                      @click="deleteParagraph(para.id, activeTab)"
                      icon="i-heroicons-trash"
                      size="xs"
                      variant="ghost"
                      color="error"
                      title="Delete"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
