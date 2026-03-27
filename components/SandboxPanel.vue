<script setup lang="ts">
import { useSandbox } from '~/composables/useSandbox'

const { t } = useI18n()

const {
  isOpen,
  panelWidth,
  consoleHeight,
  consoleLogs,
  isIncludeConsole,
  state,
  setIframeRef,
  updateCode,
  reset,
  clearConsole,
  closePanel
} = useSandbox()

const iframeEl = ref<HTMLIFrameElement | null>(null)

watch(iframeEl, (el) => {
  if (el) {
    setIframeRef(el)
  }
})

const consoleFilter = ref<'all' | 'log' | 'warn' | 'error'>('all')
const isResizingWidth = ref(false)
const isResizingHeight = ref(false)

const filteredLogs = computed(() => {
  if (consoleFilter.value === 'all') return consoleLogs.value
  return consoleLogs.value.filter(log => log.level === consoleFilter.value)
})

const logCounts = computed(() => ({
  all: consoleLogs.value.length,
  log: consoleLogs.value.filter(l => l.level === 'log').length,
  warn: consoleLogs.value.filter(l => l.level === 'warn').length,
  error: consoleLogs.value.filter(l => l.level === 'error').length
}))

const handleWidthMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  isResizingWidth.value = true
  document.addEventListener('mousemove', handleWidthMouseMove)
  document.addEventListener('mouseup', handleWidthMouseUp)
}

const handleWidthMouseMove = (e: MouseEvent) => {
  if (isResizingWidth.value) {
    const container = document.querySelector('.sandbox-panel')
    if (container) {
      const rect = container.getBoundingClientRect()
      const newWidth = e.clientX - rect.left
      panelWidth.value = Math.max(300, Math.min(1000, newWidth))
    }
  }
}

const handleWidthMouseUp = () => {
  isResizingWidth.value = false
  document.removeEventListener('mousemove', handleWidthMouseMove)
  document.removeEventListener('mouseup', handleWidthMouseUp)
}

const handleHeightMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  isResizingHeight.value = true
  document.addEventListener('mousemove', handleHeightMouseMove)
  document.addEventListener('mouseup', handleHeightMouseUp)
}

const handleHeightMouseMove = (e: MouseEvent) => {
  if (isResizingHeight.value) {
    const container = document.querySelector('.sandbox-panel')
    if (container) {
      const rect = container.getBoundingClientRect()
      const headerHeight = 40
      const newConsoleHeight = e.clientY - rect.top - headerHeight
      const totalHeight = rect.height
      const minHeight = 80
      const maxHeight = totalHeight - 80
      consoleHeight.value = Math.max(minHeight, Math.min(maxHeight, newConsoleHeight))
    }
  }
}

const handleHeightMouseUp = () => {
  isResizingHeight.value = false
  document.removeEventListener('mousemove', handleHeightMouseMove)
  document.removeEventListener('mouseup', handleHeightMouseUp)
}

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getLogClass = (level: string) => {
  switch (level) {
    case 'warn': return 'text-yellow-500'
    case 'error': return 'text-red-500'
    default: return 'text-gray-600 dark:text-gray-400'
  }
}

const panelStyle = computed(() => ({
  width: `${panelWidth.value}px`,
  right: isOpen.value ? '0' : `-${panelWidth.value}px`
}))

const iframeStyle = computed(() => {
  const totalHeight = 400
  const consoleSection = isIncludeConsole.value ? consoleHeight.value : 0
  return {
    height: `calc(100% - ${consoleSection}px)`
  }
})

const consoleStyle = computed(() => ({
  height: `${consoleHeight.value}px`
}))
</script>

<template>
  <div
    class="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col relative"
  >
    <!-- Left resize handle for width -->
    <div
      class="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-primary-500 transition-colors z-10"
      title="Drag to resize width"
      @mousedown="handleWidthMouseDown"
    />
    
    <div class="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <span class="font-semibold text-sm">{{ t('sandbox.title') || 'Sandbox' }}</span>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-heroicons-arrow-path"
          size="xs"
          variant="ghost"
          :title="t('sandbox.reset') || 'Reset'"
          @click="reset"
        />
        <UButton
          icon="i-heroicons-x-mark"
          size="xs"
          variant="ghost"
          :title="t('sandbox.close') || 'Close'"
          @click="closePanel"
        />
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex flex-col">
      <div class="flex-1 bg-white relative" :style="iframeStyle">
        <iframe
          ref="iframeEl"
          class="w-full h-full border-0"
          sandbox="allow-scripts"
          title="Sandbox"
        />
        
        <div
          class="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize bg-transparent hover:bg-primary/50 transition-colors"
          @mousedown="handleHeightMouseDown"
        />
      </div>

      <div
        v-if="isIncludeConsole"
        class="border-t border-gray-200 dark:border-gray-700 flex flex-col"
        :style="consoleStyle"
      >
        <div class="flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-gray-900 text-xs">
          <div class="flex items-center gap-1">
            <button
              :class="['px-2 py-0.5 rounded', consoleFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700']"
              @click="consoleFilter = 'all'"
            >
              All ({{ logCounts.all }})
            </button>
            <button
              :class="['px-2 py-0.5 rounded', consoleFilter === 'log' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700']"
              @click="consoleFilter = 'log'"
            >
              Log ({{ logCounts.log }})
            </button>
            <button
              :class="['px-2 py-0.5 rounded', consoleFilter === 'warn' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-gray-700']"
              @click="consoleFilter = 'warn'"
            >
              Warn ({{ logCounts.warn }})
            </button>
            <button
              :class="['px-2 py-0.5 rounded', consoleFilter === 'error' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700']"
              @click="consoleFilter = 'error'"
            >
              Error ({{ logCounts.error }})
            </button>
          </div>
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            :title="t('sandbox.clearConsole') || 'Clear'"
            @click="clearConsole"
          />
        </div>
        
        <div class="flex-1 overflow-auto p-2 bg-gray-50 dark:bg-gray-900 font-mono text-xs">
          <div
            v-for="(log, index) in filteredLogs"
            :key="index"
            :class="['mb-1', getLogClass(log.level)]"
          >
            <span class="text-gray-400">[{{ formatTimestamp(log.timestamp) }}]</span>
            <span class="ml-1">{{ log.message }}</span>
          </div>
          <div v-if="filteredLogs.length === 0" class="text-gray-400 text-center py-4">
            {{ t('sandbox.noLogs') || 'No console output' }}
          </div>
        </div>
      </div>
    </div>

    <div
      class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-primary/50 transition-colors -translate-x-1/2"
      @mousedown="handleWidthMouseDown"
    />
  </div>
</template>
