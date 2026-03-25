<script setup lang="ts">
interface Preview {
  slide_number: number
  width: number
  height: number
  data: string
}

interface PreviewResult {
  success: boolean
  previews: Preview[]
  total_slides: number
  previewed_slides: number
}

const props = defineProps<{
  previews: Preview[]
  totalSlides: number
  path?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const currentSlide = ref(0)
const isLoading = ref(false)

const openInApp = async () => {
  if (!props.path) return

  isLoading.value = true
  try {
    await $fetch(`/api/pptx/open?path=${encodeURIComponent(props.path)}`)
  } catch (e) {
    console.error('Failed to open:', e)
  } finally {
    isLoading.value = false
  }
}

const downloadPptx = () => {
  if (!props.path) return

  const link = document.createElement('a')
  link.href = `file://${props.path}`
  link.download = props.path.split('/').pop() || 'presentation.pptx'
  link.click()
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div>
          <h2 class="text-lg font-semibold">Presentation Preview</h2>
          <p class="text-sm text-gray-500">Slide {{ Number(currentSlide) + 1 }} of {{ previews.length }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="path"
            :loading="isLoading"
            icon="i-heroicons-arrow-top-right-on-square"
            @click="openInApp"
          >
            Open in App
          </UButton>
          <UButton
            v-if="path"
            icon="i-heroicons-arrow-down-tray"
            variant="outline"
            @click="downloadPptx"
          >
            Download
          </UButton>
          <UButton icon="i-heroicons-x-mark" variant="ghost" @click="emit('close')" />
        </div>
      </div>

      <!-- Preview Area -->
      <div class="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-800">
        <div class="flex justify-center">
          <div class="relative">
            <img
              v-if="previews[currentSlide]"
              :src="previews[currentSlide].data"
              :alt="`Slide ${currentSlide + 1}`"
              class="max-w-full rounded-lg shadow-lg"
              style="max-height: 60vh;"
            />
            <div v-else class="w-[960px] h-[540px] bg-white rounded-lg flex items-center justify-center">
              <p class="text-gray-400">No preview available</p>
            </div>

            <!-- Navigation -->
            <button
              v-if="currentSlide > 0"
              class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white dark:bg-gray-700 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600"
              @click="currentSlide--"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-6 h-6" />
            </button>
            <button
              v-if="currentSlide < previews.length - 1"
              class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white dark:bg-gray-700 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600"
              @click="currentSlide++"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <!-- Slide Thumbnails -->
      <div class="p-4 border-t dark:border-gray-700">
        <div class="flex gap-2 overflow-x-auto pb-2">
          <button
            v-for="(preview, idx) in previews"
            :key="idx"
            class="flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all"
            :class="idx === currentSlide ? 'border-primary-500' : 'border-transparent hover:border-gray-300'"
            @click="currentSlide = idx"
          >
            <img
              :src="preview.data"
              :alt="`Slide ${Number(idx) + 1}`"
              class="w-24 h-auto object-cover"
            />
            <p class="text-xs text-center py-1 bg-gray-100 dark:bg-gray-700">{{ Number(idx) + 1 }}</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
