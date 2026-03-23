<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import hljs from 'highlight.js'

const props = defineProps<{
  initialCode: string
  language?: string
  editable?: boolean
}>()

const emit = defineEmits<{
  change: [code: string]
  run: [code: string]
}>()

const isEditing = ref(false)
const editCode = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isRunning = ref(false)

const highlightedCode = ref('')

watch(() => props.initialCode, (newCode) => {
  editCode.value = newCode
  highlight()
}, { immediate: true })

function highlight() {
  const lang = hljs.getLanguage(props.language || 'plaintext') ? props.language : 'plaintext'
  highlightedCode.value = hljs.highlight(props.initialCode, { language: lang, ignoreIllegals: true }).value
}

function startEdit() {
  if (!props.editable) return
  isEditing.value = true
  editCode.value = props.initialCode
  nextTick(() => {
    const textarea = document.querySelector(`#editor-${props.language}`) as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
      // Set cursor to end
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

function saveEdit() {
  if (editCode.value !== props.initialCode) {
    emit('change', editCode.value)
  }
  isEditing.value = false
}

function cancelEdit() {
  editCode.value = props.initialCode
  isEditing.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelEdit()
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    saveEdit()
  }
}

function runCode() {
  if (!props.editable) return
  isRunning.value = true
  emit('run', editCode.value)
  setTimeout(() => {
    isRunning.value = false
  }, 1000)
}

function handleFold(e: Event) {
  const btn = e.target as HTMLElement
  const container = btn.closest('.executable-code-block') as HTMLElement
  const pre = container?.querySelector('.code-content') as HTMLElement
  if (pre) {
    pre.classList.toggle('hidden')
    const svg = btn.querySelector('svg')
    if (svg) {
      svg.style.transform = pre.classList.contains('hidden') ? 'rotate(-90deg)' : ''
    }
  }
}

onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const foldBtn = target.closest('.fold-code-btn') as HTMLElement
    if (foldBtn) {
      handleFold(e)
    }
  })
})
</script>

<template>
  <div 
    class="executable-code-block" 
    :data-language="language"
    style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 8px 0; background: #fafafa;"
    :class="{ 'cursor-pointer': editable }"
  >
    <div 
      class="code-block-header" 
      v-if="!isEditing"
      style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb;"
    >
      <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">{{ language }}</span>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button 
          @click.stop="startEdit"
          v-if="editable"
          class="fold-code-btn" 
          style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"
          title="Click to edit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button 
          @click.stop="runCode"
          :disabled="isRunning"
          class="run-code-btn" 
          style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
          title="Run code (Ctrl+Enter)"
        >
          <svg v-if="!isRunning" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Edit mode: textarea -->
    <div v-if="isEditing" style="position: relative;">
      <textarea
        :id="`editor-${language}`"
        v-model="editCode"
        @blur="saveEdit"
        @keydown="handleKeydown"
        class="code-editor"
        style="width: 100%; min-height: 100px; margin: 0; padding: 12px; font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Mono', monospace; font-size: 13px; line-height: 1.5; color: #374151; background: #fafafa; border: none; outline: none; resize: vertical;"
        spellcheck="false"
      />
      <div style="position: absolute; bottom: 8px; right: 8px; display: flex; gap: 4px;">
        <button 
          @click.stop="cancelEdit" 
          style="padding: 4px 8px; font-size: 11px; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;"
        >
          Esc
        </button>
        <button 
          @click.stop="saveEdit" 
          style="padding: 4px 8px; font-size: 11px; color: white; background: #3b82f6; border: none; border-radius: 4px; cursor: pointer;"
        >
          Save
        </button>
      </div>
    </div>

    <!-- View mode: syntax highlighted code -->
    <pre 
      v-else 
      class="code-content" 
      style="margin: 0; padding: 12px; overflow-x: auto; background: #fafafa;"
    ><code 
        class="hljs" 
        :class="`language-${language}`" 
        style="font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Mono', monospace; font-size: 13px; line-height: 1.5; color: #374151;"
        v-html="highlightedCode"
      ></code></pre>
  </div>
</template>

<style scoped>
.executable-code-block:hover {
  border-color: #9ca3af;
}
</style>