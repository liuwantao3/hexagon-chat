<script setup lang="ts">
import { MODEL_FAMILIES } from '~/config/models'
import type { ContextKeys } from '~/server/middleware/keys'

interface ModelStatus {
  name: string
  family: string
  hasKey: boolean
  status: 'success' | 'error' | 'pending' | 'unknown'
  modelCount: number
  error?: string
}

const props = defineProps<{
  keysData: ContextKeys
  models: Array<{ name: string; details: { family: string } }>
}>()

const { t } = useI18n()

const modelStatuses = computed<ModelStatus[]>(() => {
  const statuses: ModelStatus[] = []
  
  // Built-in providers
  const providerKeys: Array<keyof Omit<ContextKeys, 'custom'>> = ['ollama', 'openai', 'azureOpenai', 'anthropic', 'moonshot', 'gemini', 'groq']
  
  providerKeys.forEach(key => {
    const familyLabel = MODEL_FAMILIES[key as keyof typeof MODEL_FAMILIES]
    if (!familyLabel) return
    
    const providerKeys = props.keysData?.[key as keyof ContextKeys] as any
    const hasKey = providerKeys?.key || key === 'ollama'
    const modelCount = props.models.filter(m => m.details?.family === familyLabel).length
    
    let status: ModelStatus['status'] = 'unknown'
    if (!hasKey) {
      status = 'unknown'
    } else if (modelCount > 0) {
      status = 'success'
    } else {
      status = 'error'
    }
    
    statuses.push({
      name: familyLabel,
      family: key,
      hasKey,
      status,
      modelCount
    })
  })

  // Custom servers
  const customServers = props.keysData?.custom || []
  customServers.forEach((server: ContextKeys['custom'][number]) => {
    if (server.name && server.key) {
      const modelCount = props.models.filter(m => m.details?.family === server.name).length
      const hasModels = modelCount > 0
      
      statuses.push({
        name: server.name,
        family: 'custom',
        hasKey: true,
        status: hasModels ? 'success' : 'error',
        modelCount
      })
    }
  })

  return statuses.filter(s => s.hasKey || s.status === 'error')
})

function getStatusColor(status: ModelStatus['status']) {
  switch (status) {
    case 'success': return 'green'
    case 'error': return 'red'
    case 'pending': return 'yellow'
    default: return 'gray'
  }
}

function getStatusIcon(status: ModelStatus['status']) {
  switch (status) {
    case 'success': return 'i-heroicons-check-circle'
    case 'error': return 'i-heroicons-exclamation-circle'
    case 'pending': return 'i-heroicons-clock'
    default: return 'i-heroicons-question-mark-circle'
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="item in modelStatuses" :key="item.name" 
         class="flex items-center justify-between p-3 rounded-lg border"
         :class="item.status === 'success' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 
                item.status === 'error' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
                'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'">
      <div class="flex items-center gap-3">
        <UIcon :name="getStatusIcon(item.status)" 
               class="w-5 h-5 flex-shrink-0"
               :class="item.status === 'success' ? 'text-green-500' : 
                      item.status === 'error' ? 'text-red-500' : 
                      item.status === 'pending' ? 'text-yellow-500' : 'text-gray-400'" />
        <div>
          <div class="font-medium">{{ item.name }}</div>
          <div class="text-sm text-gray-500">
            {{ item.modelCount }} {{ t('settings.modelsLoaded') }}
            <span v-if="item.status === 'error'" class="text-red-500"> - {{ t('settings.connectionFailed') }}</span>
          </div>
        </div>
      </div>
      <UBadge v-if="item.status === 'success'" color="green" variant="subtle">
        {{ t('settings.connected') }}
      </UBadge>
      <UBadge v-else-if="item.status === 'error'" color="red" variant="subtle">
        {{ t('settings.disconnected') }}
      </UBadge>
      <UBadge v-else color="gray" variant="subtle">
        {{ t('settings.notConfigured') }}
      </UBadge>
    </div>
    
    <div v-if="modelStatuses.length === 0" class="text-center py-4 text-gray-500">
      {{ t('settings.noConfiguredModels') }}
    </div>
  </div>
</template>
