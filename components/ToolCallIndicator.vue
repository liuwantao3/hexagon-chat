<script lang="ts" setup>
import type { ChatMessage } from '~/types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

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

const icon = (name: string) => {
  return toolIconMap[name?.toLowerCase()] || toolIconMap.default
}

const toolCalls = computed(() => {
  return props.message.toolCalls || []
})
</script>

<template>
  <div v-if="toolCalls.length > 0" class="flex flex-col my-2 ml-4">
    <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
      <span class="mr-1">⚙</span>
      <span class="font-medium">Calling tools...</span>
    </div>
    
    <div class="text-xs space-y-1">
      <div 
        v-for="(tc, index) in toolCalls" 
        :key="index"
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1"
      >
        <span>{{ icon(tc.name) }}</span>
        <span class="font-medium">{{ tc.name }}</span>
      </div>
    </div>
  </div>
</template>