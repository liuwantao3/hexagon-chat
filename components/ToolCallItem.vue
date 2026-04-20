<script lang="ts" setup>
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const markdown = useMarkdown()

const toolIconMap: Record<string, string> = {
  bash: '$',
  shell: '$',
  write: '←',
  read: '📄',
  glob: '✱',
  grep: '⌕',
  webfetch: '🌐',
  edit: '✎',
  task: '◎',
  question: '?',
  todowrite: '☑',
  default: '⚙',
}

const icon = computed(() => {
  const toolName = props.message.toolName?.toLowerCase() || ''
  return toolIconMap[toolName] || toolIconMap.default
})

const toolName = computed(() => {
  return props.message.toolName || 'Tool'
})

const toolOutput = computed(() => {
  return props.message.toolOutput || ''
})

// Check if content is long enough to need collapsing
const shouldTruncate = computed(() => {
  return toolOutput.value.length > 200
})

// Default to COLLAPSED
const expanded = ref(false)

const displayOutput = computed(() => {
  if (!expanded.value && shouldTruncate.value) {
    return toolOutput.value.substring(0, 200) + '...'
  }
  return toolOutput.value
})

// Show toggle button when there's content
const hasToggle = computed(() => {
  return toolOutput.value.length > 0
})

const isError = computed(() => {
  const output = props.message.toolOutput || ''
  try {
    const parsed = JSON.parse(output)
    return parsed.error
  } catch {
    return output.toLowerCase().includes('error')
  }
})

const parsedContent = computed(() => {
  const content = props.message.toolOutput || ''
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
})

const isSvgToolResult = computed(() => {
  return parsedContent.value?.svg
})

const isImageToolResult = computed(() => {
  return parsedContent.value?.imageUrls && parsedContent.value.imageUrls.length > 0
})

const isPptPreviewResult = computed(() => {
  return parsedContent.value?.previews && parsedContent.value.previews.length > 0
})

const imageError = computed(() => {
  return parsedContent.value?.error
})
</script>

<template>
  <div class="flex flex-col my-2 ml-4">
    <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
      <span class="mr-1">{{ icon }}</span>
      <span class="font-medium">{{ toolName }}</span>
      <span v-if="isError" class="ml-2 text-red-500">Error</span>
    </div>
    
    <div class="text-xs font-mono"
         :class="isError ? 'bg-red-50 dark:bg-red-900/30 border-l-2 border-red-500' : 'bg-gray-50 dark:bg-gray-800/50 border-l-2 border-gray-300 dark:border-gray-600'">
      <div class="p-2 overflow-hidden">
        <SvgViewer v-if="isSvgToolResult" :svg-code="parsedContent.svg" />
        
        <div v-else-if="isImageToolResult" class="flex flex-wrap gap-2 mt-2">
          <img 
            v-for="(url, index) in parsedContent.imageUrls" 
            :key="index"
            :src="url" 
            :alt="`Generated image ${index + 1}`"
            class="max-w-full h-auto rounded-lg shadow-md"
          />
        </div>
        
        <div v-else-if="isPptPreviewResult" class="mt-2">
          <div class="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span class="text-white font-bold text-lg">{{ parsedContent.total_slides }}</span>
              </div>
              <div>
                <p class="text-sm font-medium text-blue-700 dark:text-blue-300">Presentation Ready</p>
                <p class="text-xs text-blue-500 dark:text-blue-400">{{ parsedContent.previews.length }} slides</p>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else-if="imageError" class="text-red-500">
          {{ imageError }}
        </div>
        
        <div v-else class="whitespace-pre-wrap">
          {{ displayOutput }}
        </div>
        
        <button 
          v-if="hasToggle"
          class="mt-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
          @click="expanded = !expanded"
        >
          <span v-if="expanded">▼</span>
          <span v-else>▶</span>
          <span>{{ expanded ? 'Collapse' : 'Expand' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>