<script setup lang="ts">
import type { ComponentInstance } from 'vue'
import ChatSessionList from '~/components/ChatSessionList.vue'
import Chat from '~/components/Chat.vue'
import SandboxPanel from '~/components/SandboxPanel.vue'
import type { ChatMessage } from '@/types/chat'

definePageMeta({
  ssr: false
})

export interface ChatSessionSettings extends Partial<Omit<ChatSession, 'id' | 'createTime'>> { }

const { t } = useI18n()
const chatSessionListRef = shallowRef<ComponentInstance<typeof ChatSessionList>>()
const chatRef = shallowRef<ComponentInstance<typeof Chat>>()
const slideover = useSlideover()
const { isMobile } = useMediaBreakpoints()
const sandbox = useSandbox()

const sessionId = ref(0)
const latestMessageId = ref(0)
const isSessionListVisible = ref(true)

watch(isMobile, val => {
    if (!val) {
        slideover.close()
    }
})

function onChangeSettings(data: ChatSessionSettings) {
    chatSessionListRef.value?.updateSessionInfo({ ...data, forceUpdateTitle: true })
}

function onMessage(data: ChatMessage | null) {
    if (data === null) return

    chatSessionListRef.value?.updateSessionInfo({
        title: data.content.slice(0, 20),
        updateTime: data.endTime || data.startTime,
    })

    if (latestMessageId.value !== data.id) {
        latestMessageId.value = data.id!
    }
}

function onNewChat() {
    chatSessionListRef.value?.createChat()
}

async function onChangeChatSession(id: number) {
    sessionId.value = id
}

function onOpenSideMenu() {
    slideover.open(ChatSessionList, {
        ref: chatSessionListRef,
        onSelect: onChangeChatSession,
        onClosePanel: () => {
            slideover.close()
        },
        side: 'left',
        preventClose: true,
    })
}

function toggleSidebar() {
    isSessionListVisible.value = !isSessionListVisible.value
}

provide('isSessionListVisible', isSessionListVisible)
</script>

<template>
    <div class="chat-container">
        <ClientOnly>
            <ChatSessionList
                             ref="chatSessionListRef"
                             class="session-list"
                             :class="{ 'hidden': !isSessionListVisible }"
                             @select="onChangeChatSession" />
        </ClientOnly>
        <Chat
              ref="chatRef"
              v-if="sessionId > 0"
              class="chat"
              :class="{ 
                  'full-width': !isSessionListVisible, 
                  'with-sidebar': isSessionListVisible,
                  'with-sandbox': sandbox.isEnabled.value && sandbox.isOpen.value 
              }"
              :session-id="sessionId"
              @change-settings="onChangeSettings"
              @message="onMessage"
              @toggle-sidebar="toggleSidebar">
            <template #left-menu-btn>
                <UButton
                         :icon="isSessionListVisible ? 'i-heroicons-chevron-double-left' : 'i-heroicons-chevron-double-right'"
                         color="gray"
                         class="menu-button"
                         @click="toggleSidebar" />
            </template>
        </Chat>
        <div v-else class="new-chat">
            <div class="flex flex-col items-center gap-4">
                <UButton icon="i-material-symbols-add" color="primary" square @click="onNewChat">
                    {{ t('chat.newChat') }}
                </UButton>
                <UButton v-if="sandbox.isEnabled.value" icon="i-heroicons-code-bracket" variant="outline" @click="sandbox.openPanel()">
                    Open Sandbox
                </UButton>
            </div>
        </div>
        <ClientOnly>
            <SandboxPanel 
                v-if="sandbox.isEnabled.value" 
                :class="sandbox.isOpen.value ? 'sandbox-panel' : 'sandbox-panel-hidden'" 
            />
        </ClientOnly>
    </div>
</template>

<style scoped>
.chat-container {
    height: 100%;
    max-width: 6xl;
    margin: 0 auto;
    display: flex;
    flex: 1;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

.session-list {
    flex-shrink: 0;
    width: var(--chat-side-width, 240px);
    transition: all 0.3s;
}

.session-list.hidden {
    display: none;
}

.chat {
    flex: 1;
    padding: 0 1rem 1rem 1rem;
    box-sizing: border-box;
    width: 100%;
    transition: all 0.3s;
}

.chat.full-width {
    width: 100%;
}

.chat.with-sidebar {
    width: calc(100% - var(--chat-side-width, 240px));
}

.chat.with-sandbox {
    width: calc(100% - var(--sandbox-width, 600px));
}

.sandbox-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: var(--sandbox-width, 600px);
    z-index: 10;
}

.sandbox-panel-hidden {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: var(--sandbox-width, 600px);
    z-index: 10;
    visibility: hidden;
    pointer-events: none;
}

.menu-button {
    margin-right: 1rem;
}

.new-chat {
    flex-grow: 1;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>