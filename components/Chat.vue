<script setup lang="ts">
import { useMutationObserver, useThrottleFn, useScroll } from '@vueuse/core'
import type { KnowledgeBase } from '@prisma/client'
import { loadOllamaInstructions, loadKnowledgeBases } from '@/utils/settings'
import { type ChatBoxFormData } from '@/components/ChatInputBox.vue'
import { type ChatSessionSettings } from '~/pages/chat/index.vue'
import { ChatSettings, SkillMarketplace } from '#components'
import SkillConfigModal from './SkillConfigModal.vue'
import type { ChatMessage } from '~/types/chat'
import { chatDefaultSettings } from '~/composables/store'
import PptPreview from '~/components/PptPreview.vue'
import { useSandbox } from '~/composables/useSandbox'

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
const stripThinkSection = computed({
  get: () => chatDefaultSettings.value.stripThinkSection,
  set: (val) => { chatDefaultSettings.value.stripThinkSection = val },
})

// Skills selector
const selectedSkills = computed({
  get: () => chatDefaultSettings.value.skills || [],
  set: (val) => { chatDefaultSettings.value.skills = val },
})

// Sandbox
const sandbox = useSandbox()
let lastSandboxUpdate = 0

// Sandbox - handle tool results and message content
const handleSandboxCode = (content: string, isToolResult?: boolean) => {
  console.log('[Sandbox] handleSandboxCode called, isToolResult:', isToolResult, 'content length:', content?.length)
  
  // Only process if sandbox is enabled in settings
  if (!sandbox?.isEnabled?.value) {
    console.log('[Sandbox] Sandbox not enabled')
    return false
  }
  if (!content || typeof content !== 'string') {
    return false
  }
  
  // Try to parse as JSON first
  try {
    const data = JSON.parse(content)
    console.log('[Sandbox] Content parsed as JSON, keys:', Object.keys(data))
    
    // Check for sandbox tool result format (has html/css/js fields)
    if (data.html || data.code || data.js || data.js_code || data.css) {
      // Debounce: don't update if we just updated
      const now = Date.now()
      if (now - lastSandboxUpdate < 500) {
        console.log('[Sandbox] Skipping duplicate update')
        return true
      }
      lastSandboxUpdate = now
      
      console.log('[Sandbox] Found code in JSON! html length:', data.html?.length, 'css:', data.css?.length, 'js:', data.js?.length)
      sandbox.updateFromCodeBlocks(
        data.html || '',
        data.css || '',
        data.code || data.js_code || data.js || ''
      )
      return true
    }
  } catch (e) {
    // Not JSON, try markdown code blocks
  }
  
  // Try markdown code blocks
  const { htmlCode, cssCode, jsCode } = extractCodeBlocks(content)
  if (htmlCode || cssCode || jsCode) {
    const now = Date.now()
    if (now - lastSandboxUpdate < 500) {
      console.log('[Sandbox] Skipping duplicate update')
      return true
    }
    lastSandboxUpdate = now
    console.log('[Sandbox] Found code in markdown blocks')
    sandbox.updateFromCodeBlocks(htmlCode, cssCode, jsCode)
    return true
  }
  
  console.log('[Sandbox] No code found to render')
  return false
}

// Extract code blocks from message content
const extractCodeBlocks = (content: string) => {
  let htmlCode = ''
  let cssCode = ''
  let jsCode = ''

  const htmlMatch = content.match(/```html\n([\s\S]*?)```/i)
  if (htmlMatch) htmlCode = htmlMatch[1].trim()

  const cssMatch = content.match(/```css\n([\s\S]*?)```/i)
  if (cssMatch) cssCode = cssMatch[1].trim()

  const jsMatch = content.match(/```(?:javascript|js)\n([\s\S]*?)```/i)
  if (jsMatch) jsCode = jsMatch[1].trim()

  return { htmlCode, cssCode, jsCode }
}

// Available skills
const availableSkills = ref<Array<{ name: string, description: string, icon: string, hasConfig: boolean }>>([])

const fetchSkills = async () => {
  try {
    const res = await $fetch<{ skills: Array<{ name: string, description: string, icon: string, hasConfig: boolean }> }>('/api/skills')
    const skills = res.skills || []
    
    for (const skill of skills) {
      skill.hasConfig = false
    }
    
    availableSkills.value = skills
  } catch (e) {
    console.error('Failed to fetch skills:', e)
  }
}

// Marketplace modal
const showMarketplace = ref(false)
const configureSkillName = ref<string | null>(null)
const configureSkillTitle = ref('')

// PPT Preview modal
const showPptPreview = ref(false)
const pptPreviewData = ref<{ previews: any[], totalSlides: number }>({ previews: [], totalSlides: 0 })

const openMarketplace = () => {
  showMarketplace.value = true
}

const closeMarketplace = () => {
  showMarketplace.value = false
}

const onSkillInstalled = (skillName: string) => {
  fetchSkills()
}

const onConfigureSkill = (skillName: string, title: string) => {
  configureSkillName.value = skillName
  configureSkillTitle.value = title
}

const onConfigureSkillFromDropdown = async (skillName: string, title: string) => {
  configureSkillName.value = skillName
  configureSkillTitle.value = title
}

const closeConfigureSkill = () => {
  configureSkillName.value = null
  configureSkillTitle.value = ''
}

const openPptPreview = (previews: any[], totalSlides: number) => {
  pptPreviewData.value = { previews, totalSlides }
  showPptPreview.value = true
}

const closePptPreview = () => {
  showPptPreview.value = false
}

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
      // Infer role from toolResult flag for records that don't have proper role
      const inferredRole = el.toolResult === true ? 'user' : (el.role || 'assistant')
      return {
        id: el.id,
        content: el.message,
        role: inferredRole,
        model: el.model,
        startTime: el.startTime || 0,
        endTime: el.endTime || 0,
        type: el.canceled ? 'canceled' : (el.failed ? 'error' : undefined),
        relevantDocs: el.relevantDocs,
        toolResult: el.toolResult,
        toolCallId: el.toolCallId,
        toolName: el.toolName,
        toolInput: el.toolInput,
        toolOutput: el.toolOutput,
        toolCalls: el.toolCalls,
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
    input.push({ type: 'text', text: (data.content || '').toString().trim() })
    input.push({ type: 'image_url', image_url: data.image })
    // console.log(input)
    // console.log("input type is an array?", Array.isArray(input))
    // console.log("input type is an string?", typeof input === 'string')

    //isStream = false
  }
  else
    input = (data.content || '').toString().trim()

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
          skills: selectedSkills.value,
        },
      })
    }
  })
}

onReceivedMessage(data => {
  if (data.sessionId !== sessionInfo.value!.id) return

  switch (data.type) {
    case 'error':
      console.log('[Chat] Error received')
      updateMessage(data, { id: data.id, content: data.message, type: 'error' })
      break
    case 'message':
      console.log('[Chat] Message received from worker, role:', data.data?.role, 'toolName:', data.data?.toolName)
      // Only increment if this is the first message (streaming starting)
      if (sendingCount.value === 0) sendingCount.value += 1
      updateMessage(data, { type: undefined, ...data.data })
      
      const isToolResult = data.data?.toolResult === true
      const toolCallId = data.data?.toolCallId
      const toolName = data.data?.toolName
      const toolInput = data.data?.toolInput
      const toolOutput = data.data?.toolOutput
      const toolCalls = data.data?.toolCalls
      const msgContent = data.data?.content || data.data?.message?.content || ''
      
      console.log('[Chat] Message received, isToolResult:', isToolResult, 'toolCallId:', toolCallId, 'toolName:', toolName, 'toolCalls:', toolCalls?.length, 'content length:', msgContent?.length)
      
      if (msgContent) {
        handleSandboxCode(msgContent, isToolResult)
      }
      break
    case 'relevant_documents':
      updateMessage(data, { type: undefined, ...data.data })
      break
    case 'flow_complete':
      console.log('[Chat] Flow complete signal received')
      // Don't decrement here - we rely on 'complete' event
      break
    case 'complete':
      console.log('[Chat] Received complete event, current sendingCount:', sendingCount.value)
      sendingCount.value = Math.max(0, sendingCount.value - 1)
      console.log('[Chat] After decrement:', sendingCount.value)
      break
    case 'abort':
      updateMessage(data, { type: 'canceled' })
      break
  }
})

onMounted(async () => {
  await Promise.all([loadOllamaInstructions(), loadKnowledgeBases(), fetchSkills()])
    .then(([res1, res2]) => {
      instructions.push(...res1)
      knowledgeBases.push(...res2)
    })
  initData(props.sessionId)
})

function updateMessage(data: WorkerSendMessage, newData: Partial<ChatMessage>) {
  const index = 'id' in data ? messages.value.findIndex(el => el.id === data.uid || el.id === data.id) : -1
  if (index > -1) {
    console.log('[Chat] updateMessage - updating existing, id:', data.id, 'index:', index)
    messages.value.splice(index, 1, { ...messages.value[index], ...newData })
  } else {
    console.log('[Chat] updateMessage - pushing new, id:', data.id, 'role:', newData.role)
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
  // Handle both string content and array content (with images)
  const content = data.content
  if (Array.isArray(content)) {
    // Find image in the original message content
    const imagePart = content.find((c: any) => c.type === 'image_url' && c.image_url)
    onSend({ 
      content: content.map((c: any) => c.type === 'text' ? c.text : '').join(''),
      image: imagePart?.image_url
    })
  } else {
    onSend({ content: content })
  }
}

async function onRemove(data: ChatMessage) {
  await clientDB.chatHistories.where('id').equals(data.id!).delete()
  messages.value = messages.value.filter(el => el.id !== data.id)
  emits('message', null)
}

async function initData(sessionId?: number) {

  const { data } = useAuth()
  const userId = data.value?.id

  //if (typeof sessionId !== 'number' || !userId) return
  if (typeof sessionId !== 'number') return

  const result = await clientDB.chatSessions.get(sessionId)
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
        <UTooltip v-if="sandbox?.isEnabled?.value" :text="sandbox?.isOpen?.value ? 'Close Sandbox' : 'Open Sandbox'" :popper="{ placement: 'top-start' }">
          <UButton 
            :icon="sandbox?.isOpen?.value ? 'i-heroicons-x-mark' : 'i-heroicons-code-bracket'" 
            :color="sandbox?.isOpen?.value ? 'primary' : 'gray'"
            class="ml-2"
            @click="sandbox?.togglePanel()" />
        </UTooltip>
      </div>
      <div ref="messageListEl" class="relative flex-1 overflow-x-hidden overflow-y-auto px-4">
        <ChatMessageItem v-for="message in visibleMessages" :key="message.id"
                         :message :sending="sendingCount > 0" :show-toggle-button="models.length > 1"
                         class="my-2"
                         :strip-think-section="stripThinkSection"
                         @resend="onResend" @remove="onRemove"
                         @open-ppt-preview="openPptPreview" />
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
            <!-- Skills Dropdown -->
            <UPopover :popper="{ placement: 'top-start' }">
              <UTooltip :text="selectedSkills.length ? `Skills: ${selectedSkills.join(', ')}` : 'Select Skills'" :popper="{ placement: 'top-start' }">
                <UButton
                         icon="i-heroicons-sparkles-20-solid"
                         :color="selectedSkills.length ? 'primary' : 'gray'"
                         class="mr-2" />
              </UTooltip>
              <template #panel>
                <div class="p-4 w-72">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-sm font-medium">Select Skills</p>
                    <UButton size="xs" variant="ghost" @click="openMarketplace">
                      <UIcon name="i-heroicons-plus" class="mr-1" />
                      Browse
                    </UButton>
                  </div>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <div v-for="skill in availableSkills" :key="skill.name" class="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded">
                      <UCheckbox
                        :model-value="selectedSkills.includes(skill.name)"
                        @update:model-value="(val) => { if (val) selectedSkills.push(skill.name); else selectedSkills = selectedSkills.filter(s => s !== skill.name) }"
                      />
                      <div class="flex-1 cursor-pointer" @click="selectedSkills.includes(skill.name) ? null : selectedSkills.push(skill.name)">
                        <span class="text-sm">{{ skill.icon }} {{ skill.name }}</span>
                        <p class="text-xs text-gray-500">{{ skill.description }}</p>
                      </div>
                      <UButton
                        v-if="skill.hasConfig"
                        size="xs"
                        variant="ghost"
                        icon="i-heroicons-cog-6-tooth"
                        @click.stop="onConfigureSkillFromDropdown(skill.name, skill.name)"
                      />
                    </div>
                    <p v-if="availableSkills.length === 0" class="text-sm text-gray-500 text-center py-4">
                      No skills installed. Click "Browse" to install.
                    </p>
                  </div>
                </div>
              </template>
            </UPopover>
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

    <!-- Skill Marketplace Modal -->
    <ClientOnly>
      <SkillMarketplace
        v-if="showMarketplace"
        @close="closeMarketplace"
        @install="onSkillInstalled"
        @configure="onConfigureSkill"
      />
    </ClientOnly>

    <!-- Skill Config Modal -->
    <div v-if="configureSkillName" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="closeConfigureSkill">
      <SkillConfigModal
        :skill-name="configureSkillName"
        :skill-title="configureSkillTitle"
        @close="closeConfigureSkill"
      />
    </div>

    <!-- PPT Preview Modal -->
    <ClientOnly>
      <PptPreview
        v-if="showPptPreview"
        :previews="pptPreviewData.previews"
        :total-slides="pptPreviewData.totalSlides"
        path="/tmp/_pptx_maker/current.pptx"
        @close="closePptPreview"
      />
    </ClientOnly>
  </div>
</template>
