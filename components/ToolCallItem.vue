<script lang="ts" setup>
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

console.log('[ToolCallItem] message received:', {
  toolResult: props.message.toolResult,
  toolName: props.message.toolName,
  toolOutput: props.message.toolOutput?.substring?.(0, 100),
  content: props.message.content?.substring?.(0, 100),
  hasImageUrls: props.message.toolOutput?.includes('imageUrls')
})

const markdown = useMarkdown()

const toolIconMap: Record<string, string> = {
  bash: '$',
  shell: '$',
  confirm: '?',
  summarize: '📝',
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
  const content = props.message.toolOutput || props.message.content || ''
  console.log('[ToolCallItem] raw toolOutput:', content.substring(0, 200))
  console.log('[ToolCallItem] has content field:', !!props.message.content)
  try {
    const parsed = JSON.parse(content)
    console.log('[ToolCallItem] parsed JSON keys:', Object.keys(parsed))
    console.log('[ToolCallItem] imageUrls:', parsed.imageUrls?.length)
    return parsed
  } catch (e) {
    console.log('[ToolCallItem] JSON parse error:', e)
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

const isHtmlToolResult = computed(() => {
  return parsedContent.value?.htmlUrls && parsedContent.value.htmlUrls.length > 0
})

const isConfirmToolResult = computed(() => {
  return parsedContent.value?.confirm === true
})

const isAlreadyConfirmed = computed(() => {
  return parsedContent.value?.confirmed === true
})

const confirmId = computed(() => {
  return parsedContent.value?.confirmId || null
})

const confirmAction = computed(() => {
  return parsedContent.value?.action || ''
})

const isSummarizeToolResult = computed(() => {
  return parsedContent.value?.summarize === true
})

const imageError = computed(() => {
  return parsedContent.value?.error
})

// Handle confirmation response
async function respondToConfirm(response: 'confirmed' | 'denied') {
  console.log('[ToolCallItem] Responding to confirm:', confirmId.value, response)
  try {
    await $fetch('/api/confirm/respond', {
      method: 'POST',
      body: { confirmId: confirmId.value, response }
    })
    // Update the UI to show the response
  } catch (e) {
    console.error('[ToolCallItem] Error responding to confirm:', e)
  }
}
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
        
        <div v-else-if="isHtmlToolResult" class="mt-2">
          <iframe 
            v-for="(url, index) in parsedContent.htmlUrls" 
            :key="index"
            :src="url"
            class="w-full h-96 rounded-lg border border-gray-300 dark:border-gray-600"
            sandbox="allow-scripts"
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

        <div v-else-if="isConfirmToolResult" class="mt-2 p-3 rounded-lg border"
          :class="isAlreadyConfirmed ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700'">
          <div class="flex items-start gap-3">
            <UIcon :name="isAlreadyConfirmed ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'" 
                   class="mt-0.5" 
                   :class="isAlreadyConfirmed ? 'text-green-500' : 'text-yellow-500'" />
            <div class="flex-1">
              <p class="font-medium" :class="isAlreadyConfirmed ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'">
                {{ isAlreadyConfirmed ? 'Confirmed' : confirmAction }}
              </p>
              <p class="text-sm mt-1" :class="isAlreadyConfirmed ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'">
                {{ isAlreadyConfirmed ? parsedContent.message : parsedContent.message }}
              </p>
              <p v-if="parsedContent.details && !isAlreadyConfirmed" class="text-xs mt-2 text-yellow-600 dark:text-yellow-400">{{ parsedContent.details }}</p>
              <div v-if="!isAlreadyConfirmed" class="flex gap-2 mt-3">
                <UButton size="sm" color="red" variant="outline" @click="respondToConfirm('denied')">Deny</UButton>
                <UButton size="sm" color="green" @click="respondToConfirm('confirmed')">Confirm</UButton>
              </div>
              <p v-else class="text-xs mt-2 text-green-600 dark:text-green-400">
                ✓ You confirmed this action. The assistant can now proceed.
              </p>
            </div>
          </div>
        </div>

        <div v-else-if="isSummarizeToolResult" class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-document-text" class="text-blue-500 mt-0.5" />
            <div class="flex-1">
              <p class="font-medium text-blue-800 dark:text-blue-200">Summary Requested</p>
              <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {{ parsedContent.format === 'brief' ? 'Generating brief summary...' : 'Generating comprehensive summary with:' }}
              </p>
              <ul v-if="parsedContent.format === 'detailed'" class="text-xs text-blue-600 dark:text-blue-400 mt-2 list-disc list-inside">
                <li>Goal - What the user is trying to accomplish</li>
                <li>Instructions - Important instructions given</li>
                <li>Discoveries - Notable things learned</li>
                <li>Accomplished - Work completed</li>
                <li>Relevant Files/Directories</li>
                <li>Pending Tasks</li>
              </ul>
              <p class="text-xs text-blue-500 dark:text-blue-400 mt-2">{{ parsedContent.note }}</p>
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