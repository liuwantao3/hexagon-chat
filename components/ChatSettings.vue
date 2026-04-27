<script lang="ts" setup>
import { loadOllamaInstructions, loadKnowledgeBases } from '~/utils/settings'
import type { KnowledgeBase } from '@prisma/client'

interface UpdatedOptions {
  title: string
  knowledgeBaseInfo?: KnowledgeBase
  instructionInfo?: any
}

const props = defineProps<{
  sessionId: number
  onClose: () => void
  onUpdated?: (data: UpdatedOptions) => void
  onClear?: () => void
}>()

const { t } = useI18n()
const confirm = useDialog('confirm')
const { getSessions, updateSession } = useServerChat()

const defaultConfig = {
  instructionId: 0,
  knowledgeBaseId: 0,
} as const

const state = reactive({
  title: '',
  ...defaultConfig,
})

const instructions = await loadOllamaInstructions()
const knowledgeBases = await loadKnowledgeBases()

const instructionContent = computed(() => {
  return instructions.find(el => el.id === state.instructionId)?.instruction || ''
})

onMounted(async () => {
  const sessions = await getSessions()
  const session = (sessions as any[]).find(s => s.id === props.sessionId)
  if (session) {
    Object.assign(state, {
      title: session.title || '',
      instructionId: session.instructionId || 0,
      knowledgeBaseId: session.knowledgeBaseId || 0,
    })
  }
})

function onClearHistory() {
  props.onClose()
  setTimeout(() => {
    confirm(t('chat.clearConfirmTip')).then(async () => {
      // Clear messages via API would be needed
      // For now, just call the callback
      props.onClear?.()
    }).catch(noop)
  }, 50)
}

async function onSave() {
  const knowledgeBaseInfo = knowledgeBases.find(el => el.id === state.knowledgeBaseId)
  const instructionInfo = instructions.find(el => el.id === state.instructionId)

  await updateSession(props.sessionId, { 
    title: state.title,
    // Note: instructionId and knowledgeBaseId would need API support
  })

  props.onUpdated?.({
    title: state.title,
    knowledgeBaseInfo: knowledgeBaseInfo as KnowledgeBase,
    instructionInfo,
  })
  props.onClose()
}

async function onReset() {
  Object.assign(state, defaultConfig)
}
</script>

<template>
  <UModal prevent-close>
    <UForm :state="state" @submit="onSave">
      <UCard>
        <template #header>
          <div class="flex items-center">
            <span class="mr-auto">{{ t("chat.chatSettingsTitle") }}</span>
            <UButton icon="i-material-symbols-close-rounded" color="gray" @click="onClose()"></UButton>
          </div>
        </template>
        <UFormGroup :label="t('chat.topic')" name="title" class="mb-4">
          <UInput v-model="state.title" maxlength="40" />
        </UFormGroup>
        <UFormGroup :label="t('chat.knowledgeBase')" name="knowledgeBaseId" class="mb-4">
          <USelectMenu v-model="state.knowledgeBaseId"
                       :options="knowledgeBases"
                       value-attribute="id"
                       option-attribute="name"
                       :placeholder="t('chat.selectKB')"></USelectMenu>
        </UFormGroup>
        <UFormGroup :label="t('instructions.instruction')" name="instructionId" class="mb-4">
          <USelectMenu v-model="state.instructionId"
                       :options="instructions"
                       option-attribute="name"
                       value-attribute="id"
                       :placeholder="t('chat.selectInstruction')"></USelectMenu>
          <div class="my-1 text-sm text-muted">{{ instructionContent }}</div>
        </UFormGroup>
        <div class="text-center mt-6">
          <UButton icon="i-material-symbols-delete-history" color="red" @click="onClearHistory">{{ t('chat.clearBtn') }}</UButton>
        </div>
        <template #footer>
          <div class="text-right">
            <UButton color="gray" class="mr-2" @click="onReset">{{ t("chat.resetToDefault") }}</UButton>
            <UButton type="submit">{{ t("global.save") }}</UButton>
          </div>
        </template>
      </UCard>
    </UForm>
  </UModal>
</template>