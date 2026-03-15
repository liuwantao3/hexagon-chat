<script lang="ts" setup>
import { MODEL_FAMILIES } from '~/config/models'
import type { ContextKeys } from '~/server/middleware/keys'

interface ConfiguredModel {
  name: string
  aiType: string
  family: string
  endpoint: string
  key: string
  proxy: boolean
  deploymentName?: string
  status: 'success' | 'error' | 'unknown'
  modelCount: number
  isBuiltIn: boolean
}

const props = defineProps<{
  keysData: ContextKeys
  models: Array<{ name: string; details: { family: string } }>
}>()

const emit = defineEmits<{
  edit: [name: string]
  remove: [name: string]
  test: [name: string]
}>()

const { t } = useI18n()

const builtInProviders = [
  { key: 'openai', name: 'OpenAI', family: 'OpenAI' },
  { key: 'azureOpenai', name: 'Azure OpenAI', family: 'Azure OpenAI' },
  { key: 'anthropic', name: 'Anthropic', family: 'Anthropic' },
  { key: 'moonshot', name: 'Moonshot', family: 'Moonshot' },
  { key: 'minimax', name: 'MiniMax', family: 'MiniMax' },
  { key: 'gemini', name: 'Gemini', family: 'Gemini' },
  { key: 'groq', name: 'Groq', family: 'Groq' },
]

const configuredModels = computed<ConfiguredModel[]>(() => {
  const result: ConfiguredModel[] = []
  
  // Ollama
  result.push({
    name: 'Ollama',
    aiType: 'ollama',
    family: 'Ollama',
    endpoint: props.keysData?.ollama?.endpoint || 'http://127.0.0.1:11434',
    key: '',
    proxy: false,
    status: 'success',
    modelCount: props.models.filter(m => m.details?.family === 'Ollama').length,
    isBuiltIn: true,
  })
  
  // Built-in cloud providers
  builtInProviders.forEach(provider => {
    const providerData = props.keysData?.[provider.key as keyof ContextKeys] as any
    const hasKey = !!providerData?.key
    const modelCount = props.models.filter(m => m.details?.family === provider.family).length
    
    let status: ConfiguredModel['status'] = 'unknown'
    if (hasKey) {
      status = modelCount > 0 ? 'success' : 'error'
    }
    
    result.push({
      name: provider.name,
      aiType: provider.key,
      family: provider.family,
      endpoint: providerData?.endpoint || '',
      key: providerData?.key || '',
      proxy: providerData?.proxy || false,
      deploymentName: providerData?.deploymentName,
      status,
      modelCount,
      isBuiltIn: true,
    })
  })
  
  // Custom servers
  const customServers = props.keysData?.custom || []
  customServers.forEach(server => {
    if (!server.name) return
    const modelCount = props.models.filter(m => m.details?.family === server.name).length
    const hasKey = !!server.key
    
    let status: ConfiguredModel['status'] = 'unknown'
    if (hasKey) {
      status = modelCount > 0 ? 'success' : 'error'
    }
    
    result.push({
      name: server.name,
      aiType: server.aiType,
      family: server.name,
      endpoint: server.endpoint,
      key: server.key,
      proxy: server.proxy,
      deploymentName: (server as any).deploymentName,
      status,
      modelCount,
      isBuiltIn: false,
    })
  })
  
  return result
})

function getStatusIcon(status: ConfiguredModel['status']) {
  switch (status) {
    case 'success': return 'i-heroicons-check-circle'
    case 'error': return 'i-heroicons-exclamation-circle'
    default: return 'i-heroicons-question-mark-circle'
  }
}

function getStatusColor(status: ConfiguredModel['status']) {
  switch (status) {
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    default: return 'text-gray-400'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="model in configuredModels" :key="model.name"
         class="flex items-center justify-between p-4 rounded-lg border"
         :class="model.status === 'success' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 
                model.status === 'error' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
                'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <UIcon :name="getStatusIcon(model.status)" 
               class="w-6 h-6 flex-shrink-0"
               :class="getStatusColor(model.status)" />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold truncate">{{ model.name }}</span>
            <UBadge v-if="model.status === 'success'" color="green" variant="subtle" size="xs">
              {{ t('settings.connected') }}
            </UBadge>
            <UBadge v-else-if="model.status === 'error'" color="red" variant="subtle" size="xs">
              {{ t('settings.disconnected') }}
            </UBadge>
            <UBadge v-else color="gray" variant="subtle" size="xs">
              {{ t('settings.notConfigured') }}
            </UBadge>
          </div>
          <div class="text-sm text-gray-500 truncate">
            {{ model.modelCount }} {{ t('settings.modelsLoaded') }}
            <span v-if="model.status === 'error'" class="text-red-500"> - {{ t('settings.connectionFailed') }}</span>
          </div>
        </div>
      </div>
      
      <div class="flex items-center gap-2 flex-shrink-0">
        <UButton v-if="model.status === 'error' && model.isBuiltIn" 
                 variant="ghost" 
                 size="sm"
                 @click="emit('test', model.name)">
          {{ t('settings.testConnection') }}
        </UButton>
        <UButton v-if="model.isBuiltIn && model.name !== 'Ollama'" 
                 variant="ghost" 
                 size="sm"
                 @click="emit('edit', model.name)">
          <UIcon name="i-heroicons-pencil" class="w-4 h-4" />
        </UButton>
        <UButton v-if="!model.isBuiltIn" 
                 variant="ghost" 
                 color="red"
                 size="sm"
                 @click="emit('remove', model.name)">
          <UIcon name="i-heroicons-trash" class="w-4 h-4" />
        </UButton>
      </div>
    </div>
    
    <div v-if="configuredModels.length === 0" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-cloud" class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>{{ t('settings.noConfiguredModels') }}</p>
    </div>
  </div>
</template>
