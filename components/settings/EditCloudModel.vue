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
  server: ContextKeys['custom'][number]
  onClose?: () => void
  onUpdate?: (server: ContextKeys['custom'][number]) => void
  onRemove?: () => void
}>()

const { t } = useI18n()

const providers: ProviderConfig[] = [
  { key: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', supportsProxy: true },
  { key: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com', supportsProxy: true },
  { key: 'moonshot', label: 'Moonshot', defaultEndpoint: 'https://api.moonshot.cn/v1', supportsProxy: false },
  { key: 'gemini', label: 'Gemini', defaultEndpoint: '', supportsProxy: true },
  { key: 'groq', label: 'Groq', defaultEndpoint: '', supportsProxy: true },
  { key: 'azureOpenai', label: 'Azure OpenAI', defaultEndpoint: '', supportsProxy: true },
]

const formData = reactive({
  name: props.server.name,
  aiType: props.server.aiType,
  endpoint: props.server.endpoint,
  key: props.server.key,
  proxy: props.server.proxy,
  deploymentName: (props.server as any).deploymentName || '',
})

const selectedProvider = computed(() => 
  providers.find(p => p.key === formData.aiType)
)

const schema = computed(() => {
  return object({
    name: string().required(t('global.required')),
    aiType: string().required(t('global.required')),
    endpoint: string().url(t('global.invalidUrl')),
    key: string().required(t('global.required')),
  })
})

function onSubmit() {
  const serverData: ContextKeys['custom'][number] = {
    name: formData.name,
    aiType: formData.aiType as any,
    endpoint: formData.endpoint,
    key: formData.key,
    proxy: formData.proxy,
    models: props.server.models,
    modelsEndpoint: props.server.modelsEndpoint,
  }

  if (formData.aiType === 'azureOpenai') {
    (serverData as any).deploymentName = formData.deploymentName
  }
  
  props.onUpdate?.(serverData)
}

const confirm = useDialog('confirm')

function onRemove() {
  confirm(t('settings.ensureRemoveCustomService')).then(() => {
    props.onRemove?.()
    props.onClose?.()
  })
}
</script>

<template>
  <UModal>
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h5>{{ t('settings.editModel') }}</h5>
          <UButton variant="ghost" color="red" size="sm" @click="onRemove">
            <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-1" />
            {{ t('settings.removeCustomService') }}
          </UButton>
        </div>
      </template>
      
      <UForm :state="formData" :schema="schema" @submit="onSubmit">
        <UFormGroup :label="t('settings.modelFamily')" name="aiType" class="mb-4">
          <USelectMenu v-model="formData.aiType"
                       :options="providers"
                       size="lg"
                       value-attribute="key"
                       option-attribute="label" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.serviceName')" name="name" class="mb-4">
          <UInput v-model.trim="formData.name" size="lg" :placeholder="selectedProvider?.label || t('global.required')" />
        </UFormGroup>

        <UFormGroup v-if="formData.aiType === 'azureOpenai'" :label="t('settings.azureDeploymentName')" name="deploymentName" class="mb-4">
          <UInput v-model.trim="formData.deploymentName" size="lg" :placeholder="t('settings.azureDeploymentName')" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.apiKey')" name="key" class="mb-4">
          <UInput v-model.trim="formData.key" size="lg" type="password" :placeholder="t('settings.apiKey')" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.endpoint')" name="endpoint" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.endpoint" size="lg" :placeholder="selectedProvider?.defaultEndpoint || 'https://...'" />
        </UFormGroup>
        
        <div v-if="selectedProvider?.supportsProxy" class="mb-4">
          <label class="flex items-center">
            <UCheckbox v-model="formData.proxy" />
            <span class="ml-2 text-sm text-muted">({{ t('settings.proxyTips') }})</span>
          </label>
        </div>
        
        <div class="flex justify-end gap-2 mt-6">
          <UButton color="gray" @click="props.onClose?.()">{{ t('global.cancel') }}</UButton>
          <UButton type="submit" color="primary">{{ t('global.save') }}</UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
