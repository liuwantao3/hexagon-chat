<script setup lang="ts">
import type { ContextKeys } from '~/server/middleware/keys'
import { keysStore, DEFAULT_KEYS_STORE } from '~/utils/settings'
import { deepClone } from '~/composables/helpers'
import { useModels } from '~/composables/useModels'
import AddCloudModel from './AddCloudModel.vue'
import EditCloudModel from './EditCloudModel.vue'
import EditBuiltInProvider from './EditBuiltInProvider.vue'
import ModelListCard from './ModelListCard.vue'

const { t } = useI18n()
const toast = useToast()
const modal = useModal()
const { loadModels, models } = useModels({ forceReload: true })

const ollamaForm = reactive({
  endpoint: '',
  username: '',
  password: '',
})

const customServers = computed(() => keysStore.value.custom || [])

const builtInProviders = ['openai', 'azureOpenai', 'anthropic', 'moonshot', 'minimax', 'gemini', 'groq']

onMounted(() => {
  loadOllamaSettings()
  loadModels()
})

function loadOllamaSettings() {
  ollamaForm.endpoint = keysStore.value.ollama?.endpoint || 'http://127.0.0.1:11434'
  ollamaForm.username = keysStore.value.ollama?.username || ''
  ollamaForm.password = keysStore.value.ollama?.password || ''
}

function onSaveOllama() {
  keysStore.value.ollama = {
    endpoint: ollamaForm.endpoint,
    username: ollamaForm.username,
    password: ollamaForm.password,
  }
  loadModels()
  toast.add({ title: t('settings.setSuccessfully'), color: 'green' })
}

function onAddCloudModel(server: ContextKeys['custom'][number]) {
  const newServers = [...(keysStore.value.custom || []), server]
  keysStore.value = Object.assign(keysStore.value, { custom: newServers })
  loadModels()
  toast.add({ title: t('settings.setSuccessfully'), color: 'green' })
}

function onEditCloudModel(server: ContextKeys['custom'][number]) {
  const index = customServers.value.findIndex(s => s.name === server.name)
  if (index !== -1) {
    keysStore.value.custom.splice(index, 1, server)
    loadModels()
    toast.add({ title: t('settings.setSuccessfully'), color: 'green' })
  }
}

function onRemoveCloudModel(name: string) {
  const index = customServers.value.findIndex(s => s.name === name)
  if (index !== -1) {
    keysStore.value.custom.splice(index, 1)
    loadModels()
  }
}

function onUpdateBuiltInProvider(providerKey: string, data: any) {
  keysStore.value[providerKey as keyof ContextKeys] = data
  loadModels()
  toast.add({ title: t('settings.setSuccessfully'), color: 'green' })
}

function openAddModal() {
  modal.open(AddCloudModel, {
    existingServers: customServers.value,
    onAdd: (server: any) => {
      onAddCloudModel(server)
    },
    onClose: () => modal.close(),
  })
}

function openEditModal(name: string) {
  // Check if it's a built-in provider
  if (builtInProviders.includes(name.toLowerCase()) || 
      ['OpenAI', 'Azure OpenAI', 'Anthropic', 'Moonshot', 'Gemini', 'Groq'].includes(name)) {
    const providerKey = name.toLowerCase().replace(' ', '').replace('azure ', 'azure')
    const keyMap: Record<string, string> = {
      'openai': 'openai',
      'azureopenai': 'azureOpenai', 
      'anthropic': 'anthropic',
      'moonshot': 'moonshot',
      'gemini': 'gemini',
      'groq': 'groq',
    }
    const providerKeyNormalized = keyMap[name.toLowerCase()] || name.toLowerCase()
    
    modal.open(EditBuiltInProvider, {
      providerKey: providerKeyNormalized,
      providerData: keysStore.value[providerKeyNormalized as keyof ContextKeys],
      onUpdate: (data) => onUpdateBuiltInProvider(providerKeyNormalized, data),
      onClose: () => modal.close(),
    })
    return
  }
  
  // Custom server
  const server = customServers.value.find(s => s.name === name)
  if (server) {
    modal.open(EditCloudModel, {
      server,
      onUpdate: (s) => {
        onEditCloudModel(s)
        modal.close()
      },
      onRemove: () => {
        onRemoveCloudModel(name)
        modal.close()
      },
      onClose: () => modal.close(),
    })
  }
}

function onTestConnection(name: string) {
  loadModels()
  toast.add({ title: t('settings.testingConnection'), color: 'blue' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Configured Models -->
    <SettingsCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t('settings.configuredModels') }}</h3>
          <UButton color="primary" @click="openAddModal">
            <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
            {{ t('settings.addCloudModel') }}
          </UButton>
        </div>
      </template>
      <ModelListCard 
        :keys-data="keysStore"
        :models="models"
        @edit="openEditModal"
        @remove="onRemoveCloudModel"
        @test="onTestConnection"
      />
    </SettingsCard>

    <!-- Ollama Configuration -->
    <SettingsCard>
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('settings.ollamaServer') }}</h3>
      </template>
      <UForm :state="ollamaForm" @submit="onSaveOllama">
        <UFormGroup :label="t('settings.endpoint')" class="mb-4">
          <UInput v-model.trim="ollamaForm.endpoint" size="lg" placeholder="http://127.0.0.1:11434" />
        </UFormGroup>
        <UFormGroup :label="t('global.userName')" class="mb-4">
          <UInput v-model.trim="ollamaForm.username" size="lg" :placeholder="t('global.optional')" />
        </UFormGroup>
        <UFormGroup :label="t('global.password')" class="mb-4">
          <UInput v-model.trim="ollamaForm.password" size="lg" type="password" :placeholder="t('global.optional')" />
        </UFormGroup>
        <UButton type="submit">
          {{ t('global.save') }}
        </UButton>
      </UForm>
    </SettingsCard>
  </div>
</template>
