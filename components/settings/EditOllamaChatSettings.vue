<script lang="ts" setup>
const props = defineProps<{
  providerData: any
  onClose?: () => void
  onUpdate?: (data: any) => void
}>()

const { t } = useI18n()

const formData = reactive({
  chatModels: props.providerData?.chatSettings?.models?.join(', ') || '',
})

function onSubmit() {
  const chatModels = formData.chatModels
    ? formData.chatModels.split(',').map(m => m.trim()).filter(m => m)
    : []
  
  const data = {
    chatSettings: {
      models: chatModels,
    },
  }
  
  props.onUpdate?.(data)
  props.onClose?.()
}
</script>

<template>
  <UModal>
    <UCard>
      <template #header>
        <h5>{{ t('settings.chatSettings') }} - Ollama</h5>
      </template>
      
      <UForm :state="formData" @submit="onSubmit">
        <UFormGroup :label="t('settings.defaultModel')" class="mb-4" :hint="t('global.optional')">
          <UInput v-model.trim="formData.chatModels" size="lg" placeholder="llama3, mistral" />
        </UFormGroup>
        
        <div class="flex justify-end gap-2 mt-6">
          <UButton color="gray" @click="props.onClose?.()">{{ t('global.cancel') }}</UButton>
          <UButton type="submit" color="primary">{{ t('global.save') }}</UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
