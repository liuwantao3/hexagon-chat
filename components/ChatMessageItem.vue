<script lang="ts" setup>
import type { ChatMessage } from '~/types/chat'
import { useKatexClient } from '~/composables/useKatexClient'
import SvgViewer from '~/components/SvgViewer.vue'

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
    // If content is an array, process each object separately
    return content.map(item => {
      if (item.type === 'text') {
        return { ...item, text: item.text.replace(regex, '') }
      }
      return item // Return image objects unchanged
    })
  } else if (typeof content === 'string') {
    // If content is a string, apply the regex directly
    return content.replace(regex, '')
  }

  // Fallback for unsupported types
  return content
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
  return parseModelValue(props.message.model)
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
        <template v-else-if="isModelMessage">
          <!-- Tool Result Display -->
          <div v-if="isToolResult" class="p-3 overflow-hidden bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500">
            <div class="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-1 flex items-center">
              <UIcon name="i-heroicons-beaker" class="mr-1" />
              Tool Result
            </div>
            <!-- SVG Display -->
            <SvgViewer v-if="isSvgToolResult" :svg-code="svgCode" />
            <!-- Image Display -->
            <div v-else-if="isImageToolResult" class="flex flex-wrap gap-2 mt-2">
              <img 
                v-for="(url, index) in imageUrls" 
                :key="index"
                :src="url" 
                :alt="`Generated image ${index + 1}`"
                class="max-w-full h-auto rounded-lg shadow-md"
              />
            </div>
            <!-- PPT Preview Display -->
            <div v-else-if="isPptPreviewResult" class="mt-2">
              <div class="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span class="text-white font-bold text-lg">{{ pptTotalSlides }}</span>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-blue-700 dark:text-blue-300">Presentation Ready</p>
                    <p class="text-xs text-blue-500 dark:text-blue-400">{{ pptPreviews.length }} slides previewed</p>
                  </div>
                </div>
                <button 
                  class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  @click="emit('openPptPreview', pptPreviews, pptTotalSlides)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview
                </button>
              </div>
            </div>
            <!-- Error Display -->
            <div v-else-if="imageError" class="text-red-500 text-xs">
              {{ imageError }}
            </div>
            <!-- Normal Tool Result -->
            <div v-else v-html="markdown.render(toolResultMarkdown)" class="md-body text-xs font-mono"></div>
          </div>
          <!-- Normal Message Display -->
          <div v-else class="p-3 overflow-hidden">
            <div :class="{ 'line-clamp-3 max-h-[5rem]': !opened }">
              <!-- Handle string case -->
              <div v-html="markdown.render(renderContent || '')" class="md-body"></div>

              <!-- Handle array of objects case -->
            </div>
            <Sources v-show="opened" :relevant_documents="message?.relevantDocs || []" />
          </div>
          <div class="flex flex-col">
            <MessageToggleCollapseButton v-if="showToggleButton" :opened="opened" @click="opened = !opened" />
          </div>
        </template>
        <template v-else-if="Array.isArray(renderContent)">
          <div v-for="(item, index) in renderContent" :key="index">
            <template v-if="item.type === 'text'">
              <div v-html="markdown.render(item.text || '')" class="md-body"></div>
            </template>
            <template v-else-if="item.type === 'image_url'">
              <img :src="item.image_url" class="max-w-full h-auto" />
            </template>
          </div>
        </template>
        <pre v-else v-text="message.content" class="p-3 whitespace-break-spaces" />
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
