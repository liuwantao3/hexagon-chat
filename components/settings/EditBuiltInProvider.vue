<script lang="ts" setup>
import { object, string } from 'yup'
import type { ContextKeys } from '~/server/middleware/keys'

interface ProviderConfig {
  key: string
  label: string
  defaultEndpoint: string
  supportsProxy: boolean
  needsModels?: boolean
}

const props = defineProps<{
  providerKey: string
  providerData: any
  onClose?: () => void
  onUpdate?: (data: any) => void
}>()

const { t } = useI18n()
const config = useRuntimeConfig()

const providers: Record<string, ProviderConfig> = {
  openai: { key: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', supportsProxy: true },
  azureOpenai: { key: 'azureOpenai', label: 'Azure OpenAI', defaultEndpoint: '', supportsProxy: true },
  anthropic: { key: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com', supportsProxy: true },
  moonshot: { key: 'moonshot', label: 'Moonshot', defaultEndpoint: 'https://api.moonshot.cn/v1', supportsProxy: false },
  minimax: { key: 'minimax', label: 'MiniMax', defaultEndpoint: 'https://api.minimax.chat/v1', supportsProxy: true, needsModels: true },
  gemini: { key: 'gemini', label: 'Gemini', defaultEndpoint: '', supportsProxy: true },
  groq: { key: 'groq', label: 'Groq', defaultEndpoint: '', supportsProxy: true },
}

const provider = computed(() => providers[props.providerKey] || providers.openai)

const formData = reactive({
  endpoint: props.providerData?.endpoint || provider.value.defaultEndpoint,
  key: props.providerData?.key || '',
  proxy: props.providerData?.proxy || false,
  deploymentName: props.providerData?.deploymentName || '',
  models: props.providerData?.models?.join(', ') || '',
  chatModels: props.providerData?.chatSettings?.models?.join(', ') || '',
  attachedMessagesCount: props.providerData?.chatSettings?.attachedMessagesCount || 10,
  secondaryKey: props.providerData?.secondary?.key || '',
  secondaryEndpoint: props.providerData?.secondary?.endpoint || '',
})

const schema = computed(() => {
  return object({
    key: string().required(t('global.required')),
  })
})

function onSubmit() {
  const endpoint = formData.endpoint || provider.value.defaultEndpoint
  const models = formData.models 
    ? formData.models.split(',').map(m => m.trim()).filter(m => m)
    : []
  const chatModels = formData.chatModels
    ? formData.chatModels.split(',').map(m => m.trim()).filter(m => m)
    : []
  
  const data: any = {
    endpoint: endpoint,
    key: formData.key,
    proxy: formData.proxy,
    models: models,
    chatSettings: {
      models: chatModels,
      attachedMessagesCount: formData.attachedMessagesCount,
    },
  }
  
  if (props.providerKey === 'azureOpenai') {
    data.deploymentName = formData.deploymentName
    data.endpoint = endpoint
  }

  if (props.providerKey === 'minimax' && formData.secondaryKey) {
    data.secondary = {
      key: formData.secondaryKey,
      endpoint: formData.secondaryEndpoint || undefined
    }
  }
  
  props.onUpdate?.(data)
  props.onClose?.()
}
</script>

<template>
  <UModal>
    <UCard>
      <template #header>
        <h5>{{ t('settings.editModel') }} - {{ provider.label }}</h5>
      </template>
      
      <UForm :state="formData" :schema="schema" @submit="onSubmit">
        <UFormGroup v-if="providerKey === 'azureOpenai'" :label="t('settings.azureDeploymentName')" name="deploymentName" class="mb-4">
          <UInput v-model.trim="formData.deploymentName" size="lg" :placeholder="t('settings.azureDeploymentName')" />
        </UFormGroup>
        
        <UFormGroup :label="t('settings.apiKey')" name="key" class="mb-4">
          <UInput v-model.trim="formData.key" size="lg" type="password" :placeholder="t('settings.apiKey')" />
        </UFormGroup>
        
        <UFormGroup v-if="providerKey !== 'azureOpenai'" :label="t('settings.endpoint')" name="endpoint" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.endpoint" size="lg" :placeholder="provider.defaultEndpoint || 'https://...'" />
        </UFormGroup>

        <template v-if="providerKey === 'minimax'">
          <div class="border-t mt-4 pt-4 mb-4">
            <h6 class="font-semibold mb-2 text-sm text-muted">{{ t('settings.secondaryApi') }}</h6>
          </div>
          <UFormGroup :label="t('settings.secondaryApiKey')" name="secondaryKey" class="mb-4" :hint="t('global.optional')">
            <UInput v-model.trim="formData.secondaryKey" size="lg" type="password" :placeholder="t('settings.secondaryApiKeyPlaceholder')" />
          </UFormGroup>
          <UFormGroup :label="t('settings.secondaryEndpoint')" name="secondaryEndpoint" class="mb-4" :hint="t('global.optional')">
            <UInput v-model.trim="formData.secondaryEndpoint" size="lg" placeholder="https://api.minimax.chat/v1" />
          </UFormGroup>
        </template>
        
        <UFormGroup v-if="providerKey === 'azureOpenai'" :label="t('settings.endpoint')" name="endpoint" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.endpoint" size="lg" placeholder="https://your-resource.openai.azure.com" />
        </UFormGroup>
        
        <UFormGroup v-if="provider.needsModels" :label="t('settings.modelNames')" name="models" class="mb-4" :hint="t('settings.modelNamesHint')">
          <UTextarea v-model.trim="formData.models" size="lg" :placeholder="t('settings.modelNamesPlaceholder')" />
        </UFormGroup>
        
        <div v-if="provider.supportsProxy" class="mb-4">
          <label class="flex items-center">
            <UCheckbox v-model="formData.proxy" />
            <span class="ml-2 text-sm text-muted">({{ t('settings.proxyTips') }})</span>
          </label>
        </div>

        <div class="border-t mt-6 pt-6">
          <h6 class="font-semibold mb-4">{{ t('settings.chatSettings') }}</h6>
          
          <UFormGroup :label="t('settings.defaultModel')" class="mb-4" :hint="t('global.optional')">
            <UInput v-model.trim="formData.chatModels" size="lg" placeholder="gpt-4o, gpt-3.5-turbo" />
          </UFormGroup>
          
          <UFormGroup :label="t('chat.attachedMessagesCount')">
            <div class="flex items-center">
              <span class="mr-2 w-6 text-primary-500">{{ formData.attachedMessagesCount }}</span>
              <URange v-model="formData.attachedMessagesCount" :min="0" :max="config.public.chatMaxAttachedMessages" size="md" />
            </div>
          </UFormGroup>
        </div>
        
        <div class="flex justify-end gap-2 mt-6">
          <UButton color="gray" @click="props.onClose?.()">{{ t('global.cancel') }}</UButton>
          <UButton type="submit" color="primary">{{ t('global.save') }}</UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
