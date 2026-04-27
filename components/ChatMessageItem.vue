<script lang="ts" setup>
import type { ChatMessage } from '~/types/chat'
import { useKatexClient } from '~/composables/useKatexClient'
import ToolCallItem from '~/components/ToolCallItem.vue'
import ToolCallIndicator from '~/components/ToolCallIndicator.vue'

const props = defineProps<{
  message: ChatMessage
  sending: boolean
  showToggleButton?: boolean
  stripThinkSection: { type: Boolean, default: false }
}>()

const emits = defineEmits<{
  resend: [message: ChatMessage]
  remove: [message: ChatMessage]
  openPptPreview: [previews: any[], totalSlides: number]
}>()

const markdown = useMarkdown()
// Initialize client-side KaTeX rendering
useKatexClient()

// Strip <Think> section
const renderContent = computed(() => {
  const regex = props.stripThinkSection ? /<think>[\s\S]*?<\/think>/gs : ''
  const content = toRaw(props.message.content)

  if (Array.isArray(content)) {
    // Extract text parts from array and join them
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text.replace(regex, ''))
      .join('')
  } else if (typeof content === 'string') {
    // If content is a string, apply the regex directly
    return content.replace(regex, '')
  }

  // Fallback for unsupported types - convert to string
  return String(content ?? '')
})

const opened = ref(props.showToggleButton === true ? false : true)
const isModelMessage = computed(() => props.message.role === 'assistant')
const contentClass = computed(() => {
  return [
    isModelMessage.value ? 'max-w-[calc(100%-2rem)]' : 'max-w-full',
    props.message.type === 'error'
      ? 'bg-red-50 dark:bg-red-800/60'
      : (isModelMessage.value ? 'bg-gray-50 dark:bg-gray-800' : 'bg-primary-50 dark:bg-primary-400/60'),
  ]
})

const timeUsed = computed(() => {
  const endTime = props.message.type === 'loading' ? Date.now() : props.message.endTime
  return Number(((endTime - props.message.startTime) / 1000).toFixed(1))
})

const modelName = computed(() => {
  const modelStr = props.message.model || ''
  if (!modelStr) return { family: '', name: '' }
  return parseModelValue(modelStr)
})

watch(() => props.showToggleButton, (value) => {
  opened.value = value === true ? false : true
})

const contentDisplay = computed(() => {
  return props.message.type === 'loading' ? 'loading' : 'normal'
})

const isToolResult = computed(() => props.message.toolResult)

const toolResultContent = computed(() => {
  if (!isToolResult.value) return null
  const content = props.message.content
  console.log('[ChatMessageItem] toolResultContent raw:', typeof content, content?.substring?.(0, 200))
  try {
    if (typeof content === 'string') {
      const parsed = JSON.parse(content)
      console.log('[ChatMessageItem] parsed JSON:', parsed)
      return parsed
    }
    return content
  } catch (e) {
    console.log('[ChatMessageItem] JSON parse error:', e)
    return null
  }
})

const toolResultMarkdown = computed(() => {
  if (!isToolResult.value) return ''
  const content = props.message.content
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    if (parsed?.markdown) {
      return parsed.markdown
    }
    if (parsed?.error) {
      return `**Error**: ${parsed.error}`
    }
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  } catch {
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  }
})

const isSvgToolResult = computed(() => {
  return toolResultContent.value?.svg
})

const svgCode = computed(() => {
  return toolResultContent.value?.svg || ''
})

const isImageToolResult = computed(() => {
  const result = toolResultContent.value?.imageUrls && toolResultContent.value.imageUrls.length > 0
  console.log('[ChatMessageItem] isImageToolResult:', result, 'imageUrls:', toolResultContent.value?.imageUrls?.length)
  return result
})

const imageUrls = computed(() => {
  const urls = toolResultContent.value?.imageUrls || []
  console.log('[ChatMessageItem] imageUrls computed:', urls.length, urls.map((u: string) => u.substring(0, 50)))
  return urls
})

const imageError = computed(() => {
  return toolResultContent.value?.error
})

const isPptPreviewResult = computed(() => {
  return toolResultContent.value?.previews && toolResultContent.value.previews.length > 0
})

const pptPreviews = computed(() => {
  return toolResultContent.value?.previews || []
})

const pptTotalSlides = computed(() => {
  return toolResultContent.value?.total_slides || 0
})
</script>

<template>
  <div class="flex flex-col my-2"
       :class="{ 'items-end': message.role === 'user' }">
    <div class="text-gray-500 dark:text-gray-400 p-1">
      <Icon v-if="message.role === 'user'" name="i-material-symbols-account-circle" class="text-lg" />
      <div v-else class="text-sm flex items-center">
        <UTooltip :text="modelName.family" :popper="{ placement: 'top' }">
          <span class="text-primary/80">{{ modelName.name }}</span>
        </UTooltip>
        <template v-if="timeUsed > 0">
          <span class="mx-2 text-muted/20 text-xs">|</span>
          <span class="text-gray-400 dark:text-gray-500 text-xs">{{ timeUsed }}s</span>
        </template>
      </div>
    </div>
    <div class="leading-6 text-sm flex items-center max-w-full message-content"
         :class="{ 'text-gray-400 dark:text-gray-500': message.type === 'canceled', 'flex-row-reverse': !isModelMessage }">
      <div class="flex border border-primary/20 rounded-lg overflow-hidden box-border"
           :class="contentClass">
        <div v-if="contentDisplay === 'loading'" class="text-xl text-primary p-3">
          <span class="block i-svg-spinners-3-dots-scale"></span>
        </div>
        <template v-else>
          <!-- Tool Result Display - shows for messages marked as tool result OR with toolName -->
          <ToolCallItem v-if="isToolResult || message.toolName" :message="message" />
          <!-- Normal Message Display -->
          <div v-else class="p-3 overflow-hidden">
            <div :class="{ 'line-clamp-3 max-h-[5rem]': !opened }">
              <div v-html="markdown.render(String(renderContent))" class="md-body"></div>
            </div>
            <Sources v-show="opened" :relevant_documents="message?.relevantDocs || []" />
          </div>
          <div class="flex flex-col">
            <MessageToggleCollapseButton v-if="showToggleButton" :opened="opened" @click="opened = !opened" />
          </div>
        </template>
      </div>
      <ChatMessageActionMore :message="message"
                             :disabled="sending"
                             @resend="emits('resend', message)"
                             @remove="emits('remove', message)">
        <UButton :class="{ invisible: sending }" icon="i-material-symbols-more-vert" color="gray"
                 :variant="'link'"
                 class="action-more">
        </UButton>
      </ChatMessageActionMore>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-content {
  .action-more {
    transform-origin: center center;
    transition: all 0.3s;
    transform: scale(0);
    opacity: 0;
  }

  &:hover {
    .action-more {
      transform: scale(1);
      opacity: 1;
    }
  }
}
</style>
