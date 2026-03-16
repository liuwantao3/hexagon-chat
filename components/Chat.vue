<script setup lang="ts">
import { useMutationObserver, useThrottleFn, useScroll } from '@vueuse/core'
import type { KnowledgeBase } from '@prisma/client'
import { loadOllamaInstructions, loadKnowledgeBases } from '@/utils/settings'
import { type ChatBoxFormData } from '@/components/ChatInputBox.vue'
import { type ChatSessionSettings } from '~/pages/chat/index.vue'
import { ChatSettings } from '#components'
import type { ChatMessage } from '~/types/chat'

type Instruction = Awaited<ReturnType<typeof loadOllamaInstructions>>[number]

const props = defineProps<{
  sessionId?: number
}>()

const emits = defineEmits<{
  // it means remove a message if `data` is null
  message: [data: ChatMessage | null]
  changeSettings: [data: ChatSessionSettings]
  'toggle-sidebar': []
}>()

const { t } = useI18n()
const { chatModels, modelSupportsVision } = useModels()
const modal = useModal()
const { onReceivedMessage, sendMessage } = useChatWorker()
const { data } = useAuth()

const supportsVision = computed(() => {
  if (models.value.length === 0) return false
  return modelSupportsVision(models.value[0])
}) // Access the data property from useAuth

const sessionInfo = ref<ChatSession>()
const knowledgeBases: KnowledgeBase[] = []
const knowledgeBaseInfo = ref<KnowledgeBase>()
const instructions: Instruction[] = []
const instructionInfo = ref<Instruction>()
const chatInputBoxRef = shallowRef()
/** `['family:model']` */
const models = ref<string[]>([])
const messages = ref<ChatMessage[]>([])
const sendingCount = ref(0)
const messageListEl = shallowRef<HTMLElement>()
const behavior = ref<ScrollBehavior>('auto')
const { y } = useScroll(messageListEl, { behavior })
const isFirstLoad = ref(true)
const limitHistorySize = computed(() => Math.max(sessionInfo.value?.attachedMessagesCount || 0, 20))

const isUserScrolling = computed(() => {
  if (isFirstLoad.value) return false

  if (messageListEl.value) {
    const bottomOffset = messageListEl.value.scrollHeight - messageListEl.value.clientHeight
    if (bottomOffset - y.value < 120) {
      return false
    }
  }
  return true
})

const scrollToBottom = (_behavior: ScrollBehavior) => {
  behavior.value = _behavior
  y.value = messageListEl.value!.scrollHeight
}

const visibleMessages = computed(() => {
  return messages.value.filter((message) => message.role !== 'system')
})

// Add new state for stripping <think> section
const stripThinkSection = ref(false)

// Method to toggle stripping <think> section
const toggleStripThinkSection = () => {
  stripThinkSection.value = !stripThinkSection.value
}

watch(() => props.sessionId, async id => {
  if (id) {
    isFirstLoad.value = true
    sendingCount.value = 0
    initData(id)
  }
})

useMutationObserver(messageListEl, useThrottleFn((e: MutationRecord[]) => {
  if (e.some(el => (el.target as HTMLElement).dataset.observer === 'ignore')) {
    return
  }
  if (!isUserScrolling.value) {
    scrollToBottom('auto')
  }
}, 250, true), { childList: true, subtree: true })

async function loadChatHistory(sessionId?: number) {
  if (typeof sessionId === 'number' && sessionId > 0) {
    const res = await clientDB.chatHistories.where('sessionId').equals(sessionId).sortBy('id')
    // Retrieve chat history based on both userId and sessionId
    // const res = await clientDB.chatHistories
    //   .where('[userId+sessionId]')
    //   .equals([userId, sessionId])
    //   .sortBy('id')

    return res.slice(-limitHistorySize.value).map(el => {
      return {
        id: el.id,
        content: el.message,
        role: el.role,
        model: el.model,
        startTime: el.startTime || 0,
        endTime: el.endTime || 0,
        type: el.canceled ? 'canceled' : (el.failed ? 'error' : undefined),
        relevantDocs: el.relevantDocs
      } as const
    })
  }
  return []
}

const onSend = async (data: ChatBoxFormData) => {
  //here to construct the message that will be sent to LLMs, mainly construct input based on content and image field from ChatInputBox component
  //later input will be assigned to message's content field
  //const input = data.content.trim()
  let input: string | any[] = []
  let isStream: boolean = true
  if (data.image) {
    //input = [{ type: 'text', text: data.content.trim() }, { type: 'image_url', image_url: data.image }]
    input.push({ type: 'text', text: data.content.trim() })
    input.push({ type: 'image_url', image_url: data.image })
    // console.log(input)
    // console.log("input type is an array?", Array.isArray(input))
    // console.log("input type is an string?", typeof input === 'string')

    //isStream = false
  }
  else
    input = data.content.trim()

  if (sendingCount.value > 0 || !input || !models.value) {
    return
  }

  const timestamp = Date.now()
  sendingCount.value = models.value.length
  chatInputBoxRef.value?.reset()

  const instructionMessage: Array<Pick<ChatMessage, 'role' | 'content'>> = instructionInfo.value
    ? [{ role: "system", content: instructionInfo.value.instruction }]
    : []

  const id = await saveMessage({
    message: input,
    model: models.value.join(','),
    role: 'user',
    startTime: timestamp,
    endTime: timestamp,
    canceled: false,
    failed: false,
    instructionId: instructionInfo.value?.id,
    knowledgeBaseId: knowledgeBaseInfo.value?.id
  })

  const userMessage = { role: "user", id, content: input, startTime: timestamp, endTime: timestamp, model: models.value.join(',') || '' } as const
  console.log("userMessage is", userMessage)
  emits('message', userMessage)
  messages.value.push(userMessage)

  nextTick(() => scrollToBottom('smooth'))

  models.value.forEach(m => {
    const model = chatModels.value.find(e => e.value === m)
    if (model) {
      const id = Math.random()
      const chatMessages = [
        instructionMessage,
        messages.value.filter(m => {
          if (m.type === 'error' || m.type === 'canceled')
            return false
          return m.role === 'user' || (m.role === 'assistant' && (m.model === model.value || (model.value === `${(m as any).family}/${m.model}` /* incompatible old data */)))
        }).slice(-(sessionInfo.value?.attachedMessagesCount || 1)),
      ].flat()
      messages.value.push({ id, role: "assistant", content: "", type: 'loading', startTime: timestamp, endTime: timestamp, model: model.value })

      sendMessage({
        type: 'request',
        uid: id,
        headers: getKeysHeader(),
        data: {
          knowledgebaseId: knowledgeBaseInfo.value?.id,
          model: model.value,
          messages: chatMessages,
          stream: isStream,
          sessionId: sessionInfo.value!.id!,
          //sessionId: sessionInfo.value?.id ?? null,
          timestamp,
        },
      })
    }
  })
}

onReceivedMessage(data => {
  if (data.sessionId !== sessionInfo.value!.id) return

  switch (data.type) {
    case 'error':
      updateMessage(data, { id: data.id, content: data.message, type: 'error' })
      break
    case 'message':
      if (sendingCount.value === 0) sendingCount.value += 1
      updateMessage(data, { type: undefined, ...data.data })
      break
    case 'relevant_documents':
      updateMessage(data, { type: undefined, ...data.data })
      break
    case 'complete':
      sendingCount.value -= 1
      break
    case 'abort':
      updateMessage(data, { type: 'canceled' })
      break
  }
})

onMounted(async () => {
  await Promise.all([loadOllamaInstructions(), loadKnowledgeBases()])
    .then(([res1, res2]) => {
      instructions.push(...res1)
      knowledgeBases.push(...res2)
    })
  initData(props.sessionId)
})

function updateMessage(data: WorkerSendMessage, newData: Partial<ChatMessage>) {
  const index = 'id' in data ? messages.value.findIndex(el => el.id === data.uid || el.id === data.id) : -1
  if (index > -1) {
    messages.value.splice(index, 1, { ...messages.value[index], ...newData })
  } else {
    messages.value.push(newData as ChatMessage)
  }
}

async function onAbortChat() {
  sendMessage({ type: 'abort', sessionId: sessionInfo.value!.id! })
  sendingCount.value = 0
}

function onOpenSettings() {
  modal.open(ChatSettings, {
    sessionId: props.sessionId!,
    onClose: () => modal.reset(),
    onUpdated: data => {
      const updatedSessionInfo: Partial<ChatSession> = {
        title: data.title,
        attachedMessagesCount: data.attachedMessagesCount,
        knowledgeBaseId: data.knowledgeBaseInfo?.id,
        instructionId: data.instructionInfo?.id,
      }
      Object.assign(sessionInfo.value!, updatedSessionInfo)

      knowledgeBaseInfo.value = data.knowledgeBaseInfo
      instructionInfo.value = data.instructionInfo

      emits('changeSettings', updatedSessionInfo)
    },
    onClear: () => {
      messages.value = []
    }
  })
}

async function onModelsChange(models: string[]) {
  await clientDB.chatSessions.update(props.sessionId!, { models })
}

async function onResend(data: ChatMessage) {
  onSend({ content: data.content })
}

async function onRemove(data: ChatMessage) {
  await clientDB.chatHistories.where('id').equals(data.id!).delete()
  messages.value = messages.value.filter(el => el.id !== data.id)
  emits('message', null)
}

async function initData(sessionId?: number) {

  const { data } = useAuth()
  console.log("User ID and User Name:", data.value?.id, data.value?.name) //Debug
  const userId = data.value?.id

  //if (typeof sessionId !== 'number' || !userId) return
  if (typeof sessionId !== 'number') return

  const result = await clientDB.chatSessions.get(sessionId)
  console.log("Session Info:", result)
  sessionInfo.value = result
  knowledgeBaseInfo.value = knowledgeBases.find(el => el.id === result?.knowledgeBaseId)
  instructionInfo.value = instructions.find(el => el.id === result?.instructionId)
  if (result?.models) {
    models.value = result.models
  }
  // incompatible old data
  else if (result?.model) {
    models.value = [`${result.modelFamily}/${result.model}`]
  }

  //messages.value = await loadChatHistory(userId, sessionId)
  messages.value = await loadChatHistory(sessionId)

  nextTick(() => {
    scrollToBottom('auto')
    isFirstLoad.value = false
  })
}

// async function saveMessage(data: Omit<ChatHistory, 'sessionId'>) {
//   return props.sessionId
//     ? await clientDB.chatHistories.add({ ...data, sessionId: props.sessionId })
//     : Math.random()
// }

async function saveMessage(data: Omit<ChatHistory, 'sessionId' | 'userId'>) {
  const { data: authData } = useAuth()
  const userId = authData.value?.id ?? null // Use the 'id' field as the user identifier
  return props.sessionId
    ? await clientDB.chatHistories.add({ ...data, sessionId: props.sessionId, userId })
    : Math.random()
}

// Add near the top of the script section

</script>

<template>
  <div class="flex box-border dark:text-gray-300 md:-mx-4 h-[calc(100vh-64px)]">
    <!-- Main chat area -->
    <div class="flex flex-col flex-1 min-w-0">
      <div class="px-4 border-b border-gray-200 dark:border-gray-700 box-border h-[57px] flex items-center">
        <slot name="left-menu-btn"></slot>
        <ChatConfigInfo v-if="instructionInfo" icon="i-iconoir-terminal"
                        :title="instructionInfo.name"
                        :description="instructionInfo.instruction"
                        class="hidden md:block" />
        <ChatConfigInfo v-if="knowledgeBaseInfo" icon="i-heroicons-book-open"
                        :title="knowledgeBaseInfo.name"
                        class="mx-2 hidden md:block" />
        <div class="mx-auto px-4 text-center">
          <h2 class="line-clamp-1">{{ sessionInfo?.title || t('chat.untitled') }}</h2>
          <div class="text-xs text-muted line-clamp-1">{{ instructionInfo?.name }}</div>
        </div>
        <UTooltip v-if="sessionId" :text="t('chat.modifyTips')">
          <UButton icon="i-iconoir-edit-pencil" color="gray" @click="onOpenSettings" />
        </UTooltip>
      </div>
      <div ref="messageListEl" class="relative flex-1 overflow-x-hidden overflow-y-auto px-4">
        <ChatMessageItem v-for="message in visibleMessages" :key="message.id"
                         :message :sending="sendingCount > 0" :show-toggle-button="models.length > 1"
                         class="my-2"
                         :strip-think-section="stripThinkSection"
                         @resend="onResend" @remove="onRemove" />
      </div>
      <div class="shrink-0 p-4 border-t border-gray-200 dark:border-gray-800">
        <ChatInputBox ref="chatInputBoxRef"
                      :disabled="models.length === 0" :loading="sendingCount > 0" :supports-vision="supportsVision"
                      @submit="onSend" @stop="onAbortChat">
          <div class="text-muted flex">
            <div class="mr-4">
              <ModelsMultiSelectMenu v-model="models" @change="onModelsChange" />
            </div>
            <!-- ToDo: Add a button here to trigger if strip think section from message or not-->
            <UTooltip :text="stripThinkSection ? t('chat.showThinkSection') : t('chat.hideThinkSection')" :popper="{ placement: 'top-start' }">
              <UButton
                       icon="i-iconoir-brain"
                       :color="stripThinkSection ? 'primary' : 'gray'"
                       @click="toggleStripThinkSection"
                       class="mr-4" />
            </UTooltip>
            <UTooltip :text="t('chat.attachedMessagesCount')" :popper="{ placement: 'top-start' }">
              <div class="flex items-center cursor-pointer hover:text-primary-400" @click="onOpenSettings">
                <UIcon name="i-material-symbols-history" class="mr-1"></UIcon>
                <span class="text-sm">{{ sessionInfo?.attachedMessagesCount }}</span>
              </div>
            </UTooltip>
          </div>
        </ChatInputBox>
      </div>
    </div>
  </div>
</template>
