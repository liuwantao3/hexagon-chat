<script lang="ts" setup>
import { object, string } from 'yup'
import { MODEL_FAMILIES } from '~/config/models'
import type { ContextKeys } from '~/server/middleware/keys'

interface ProviderConfig {
  key: string
  label: string
  defaultEndpoint: string
  supportsProxy: boolean
}

const props = defineProps<{
  existingServers: ContextKeys['custom']
  onClose?: () => void
  onAdd?: (server: ContextKeys['custom'][number]) => void
}>()

const { t } = useI18n()

const providers: ProviderConfig[] = [
  { key: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', supportsProxy: true },
  { key: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com', supportsProxy: true },
  { key: 'moonshot', label: 'Moonshot', defaultEndpoint: 'https://api.moonshot.cn/v1', supportsProxy: false },
  { key: 'minimax', label: 'MiniMax', defaultEndpoint: 'https://api.minimax.chat/v1', supportsProxy: false },
  { key: 'gemini', label: 'Gemini', defaultEndpoint: '', supportsProxy: true },
  { key: 'groq', label: 'Groq', defaultEndpoint: '', supportsProxy: true },
  { key: 'azureOpenai', label: 'Azure OpenAI', defaultEndpoint: '', supportsProxy: true },
]

const formData = reactive({
  name: '',
  aiType: 'openai',
  endpoint: '',
  key: '',
  proxy: false,
  deploymentName: '',
  models: [] as string[],
})

const selectedProvider = computed(() => 
  providers.find(p => p.key === formData.aiType)
)

watch(() => formData.aiType, (type) => {
  const provider = providers.find(p => p.key === type)
  if (provider) {
    formData.endpoint = provider.defaultEndpoint
    formData.name = provider.label
  }
}, { immediate: true })

const schema = computed(() => {
  return object({
    name: string().required(t('global.required')),
    aiType: string().required(t('global.required')),
    endpoint: string().url(t('global.invalidUrl')),
    key: string().required(t('global.required')),
  })
})

const isNameDuplicate = computed(() => {
  return props.existingServers.some(s => s.name === formData.name)
})

function onSubmit() {
  if (isNameDuplicate.value) {
    return
  }
  
  const serverData: ContextKeys['custom'][number] = {
    name: formData.name,
    aiType: formData.aiType as any,
    endpoint: formData.endpoint,
    key: formData.key,
    proxy: formData.proxy,
    models: [],
    modelsEndpoint: '/models',
  }

  // Handle Azure OpenAI specific fields
  if (formData.aiType === 'azureOpenai') {
    serverData.endpoint = formData.endpoint
    // Store deploymentName in a way that can be retrieved later
    ;(serverData as any).deploymentName = formData.deploymentName
  }
  
  props.onAdd?.(serverData)
  props.onClose?.()
}
</script>

<template>
  <UModal>
    <UCard>
      <template #header>
        <h5>{{ t('settings.addCloudModel') }}</h5>
      </template>
      
      <UForm :state="formData" :schema="schema" @submit="onSubmit">
        <UFormGroup :label="t('settings.modelFamily')" name="aiType" class="mb-4">
          <USelectMenu v-model="formData.aiType"
                       :options="providers"
                       size="lg"
                       value-attribute="key"
                       option-attribute="label" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.serviceName')" name="name" class="mb-4" :hint="t('settings.serviceNameHint')">
          <UInput v-model.trim="formData.name" size="lg" :placeholder="selectedProvider?.label || t('global.required')" />
        </UFormGroup>
        
        <UFormGroup v-if="formData.aiType === 'azureOpenai'" :label="t('settings.azureDeploymentName')" name="deploymentName" class="mb-4">
          <UInput v-model.trim="formData.deploymentName" size="lg" :placeholder="t('settings.azureDeploymentName')" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.apiKey')" name="key" class="mb-4">
          <UInput v-model.trim="formData.key" size="lg" type="password" :placeholder="t('settings.apiKey')" />
        </UFormGroup>
        
        <UFormGroup v-if="formData.aiType !== 'azureOpenai'" :label="t('settings.endpoint')" name="endpoint" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.endpoint" size="lg" :placeholder="selectedProvider?.defaultEndpoint || 'https://...'" />
        </UFormGroup>
        
        <UFormGroup v-if="formData.aiType === 'azureOpenai'" :label="t('settings.endpoint')" name="endpoint" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.endpoint" size="lg" placeholder="https://your-resource.openai.azure.com" />
        </UFormGroup>
        
        <div v-if="selectedProvider?.supportsProxy" class="mb-4">
          <label class="flex items-center">
            <UCheckbox v-model="formData.proxy" />
            <span class="ml-2 text-sm text-muted">({{ t('settings.proxyTips') }})</span>
          </label>
        </div>
        
        <div v-if="isNameDuplicate" class="text-red-500 text-sm mb-4">
          {{ t('settings.customServiceNameExists') }}
        </div>
        
        <div class="flex justify-end gap-2 mt-6">
          <UButton color="gray" @click="props.onClose?.()">{{ t('global.cancel') }}</UButton>
          <UButton type="submit" color="primary" :disabled="isNameDuplicate">{{ t('global.save') }}</UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
