<script lang="ts" setup>
import { useStorage } from '@vueuse/core'
import { USlideover } from '#components'

const emits = defineEmits<{
  select: [sessionId: number]
  closePanel: []
}>()

const { t } = useI18n()
const { getSessions, createSession, updateSession, deleteSession } = useServerChat()
const { isMobile } = useMediaBreakpoints()

const sessionList = ref<any[]>([])
const currentSessionId = useStorage<number>('currentSessionId', 0)
const confirm = useDialog('confirm')

onMounted(async () => {
  await refreshSessionList()

  if (sessionList.value.length > 0) {
    if (currentSessionId.value === -1 || !sessionList.value.some(el => el.id === currentSessionId.value)) {
      currentSessionId.value = sessionList.value[0]?.id || -1
    }
    emits('select', currentSessionId.value)
  }
})

defineExpose({ refreshSessionList, updateSessionInfo, createChat: onNewChat })

async function refreshSessionList() {
  const sessions = await getSessions()
  sessionList.value = (sessions as any[]).map(s => ({
    ...s,
    isTop: s.isTop || 0
  }))
  sessionList.value = sortSessionList(sessionList.value)
}

async function onNewChat() {
  const result = await createSession(t('chat.newChat'))
  sessionList.value.unshift({ ...result, isTop: 0, createTime: Date.now(), updateTime: Date.now() })
  onSelectChat(result.id)
}

function onSelectChat(sessionId: number) {
  currentSessionId.value = sessionId
  emits('select', sessionId)
}

async function onTopChat(item: any, direction: string) {
  const isTop = direction == 'up' ? Date.now() : 0
  await updateSession(item.id, { title: item.title })
  item.isTop = isTop
  await refreshSessionList()
}

async function onDeleteChat(data: any) {
  confirm(t("chat.deleteChatConfirm", [data.title || `${t("chat.newChat")} ${data.id}`]), {
    title: t('chat.deleteChat'),
    dangerouslyUseHTMLString: true,
  })
    .then(async () => {
      const sessionId = data.id
      sessionList.value = sessionList.value.filter(el => el.id !== sessionId)
      await deleteSession(sessionId)

      if (currentSessionId.value === sessionId) {
        if (sessionList.value.length > 0) {
          onSelectChat(sessionList.value[0].id)
        } else {
          onSelectChat(0)
        }
      }
    })
    .catch(noop)
}

function sortSessionList(data: any[]) {
  const pinTopList: any[] = []
  const list: any[] = []

  data.forEach(el => el.isTop > 0 ? pinTopList.push(el) : list.push(el))
  pinTopList.sort((a, b) => b.isTop - a.isTop)
  list.sort((a, b) => b.updateTime - a.updateTime)
  return [...pinTopList, ...list]
}

async function updateSessionInfo(data: { title?: string; forceUpdateTitle?: boolean; models?: string[] }) {
  const currentSession = sessionList.value.find(el => el.id === currentSessionId.value)
  if (!currentSession) return

  let savedData: any = { ...data }
  if (!data.forceUpdateTitle) {
    delete savedData.forceUpdateTitle
  } else {
    delete savedData.forceUpdateTitle
  }

  if (Object.keys(savedData).length > 0) {
    Object.assign(currentSession, savedData)
    await updateSession(currentSessionId.value, savedData)
    sessionList.value = sortSessionList(sessionList.value)
  }
}

async function onRenameSession(item: any) {
  const newName = prompt('Enter a new name for the session:', item.title || `${t("chat.rename")} ${item.id}`)
  const title = newName === null ? undefined : newName
  if (title !== undefined) {
    await updateSessionInfo({ title, forceUpdateTitle: true })
  }
}

</script>

<template>
  <Component :is="isMobile ? USlideover : 'div'"
             :class="isMobile ? 'w-[80vw] max-w-[400px] h-full' : 'border-r dark:border-gray-800'"
             class="h-full box-border">
    <!-- chat session list area -->
    <div class="p-3 border-b border-primary-400/30 flex items-center">
      <h3 class="text-primary-600 dark:text-primary-300 mr-auto">{{ t("chat.allChats") }} ({{ sessionList.length }})</h3>
      <UTooltip :text="t('chat.newChat')" :popper="{ placement: 'top' }">
        <UButton icon="i-material-symbols-add" color="primary" square @click="onNewChat"></UButton>
      </UTooltip>
      <UButton icon="i-material-symbols-close-rounded" color="gray" class="md:hidden ml-4" @click="emits('closePanel')"></UButton>
    </div>
    <TransitionGroup tag="div" name="list" class="h-[calc(100%-57px)] overflow-auto">
      <div v-for="item in sessionList" :key="item.id"
           class="session-item relative box-border p-2 cursor-pointer dark:text-gray-300 border-b border-b-gray-100 dark:border-b-gray-100/5 border-l-2"
           :class="[
             item.isTop ? 'bg-primary-300/10 dark:bg-primary-800/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30',
             currentSessionId === item.id ? 'border-l-pink-700/80 dark:border-l-pink-400/80' : 'border-l-transparent'
           ]"
           @click="onSelectChat(item.id)">
        <div class="w-full flex items-center text-sm h-[32px]">
          <div class="line-clamp-1 grow"
               :class="currentSessionId === item.id ? 'text-pink-700  dark:text-pink-400 font-bold' : 'opacity-80'">
            {{ item.title || `${t("chat.newChat")} ${item.id}` }}
          </div>
          <ChatSessionListActionMore :data="item"
                                     class="action-more"
                                     @pin="onTopChat(item, 'up')"
                                     @unpin="onTopChat(item, 'down')"
                                     @delete="onDeleteChat(item)"
                                     @rename="onRenameSession(item)" />
        </div>
      </div>
    </TransitionGroup>
  </Component>
</template>

<style lang="scss" scoped>
.session-item {

  :deep() {
    @media (pointer: fine) {
      .action-more {
        display: none;
      }
    }
  }

  &:hover {
    :deep() .action-more {
      display: block;
    }
  }
}

.list-enter-active,
.list-leave-active {
  transform-origin: left center;
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-100%) scale(0.3);
}
</style>