<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { keysStore } from '~/utils/settings'

const { t } = useI18n()

const sandboxEnabled = useStorage<boolean>('sandboxEnabled', false)
const autoScreenshot = useStorage<boolean>('autoScreenshot', true)
const includeConsole = useStorage<boolean>('includeConsole', true)
const visionModel = useStorage<string>('visionModel', '')

const visionModels = computed(() => {
  const models: { label: string; value: string; family: string }[] = []
  
  if (keysStore.value.openai?.key) {
    models.push({ label: 'OpenAI GPT-4V', value: 'openai-gpt4v', family: 'openai' })
  }
  if (keysStore.value.anthropic?.key) {
    models.push({ label: 'Claude Vision', value: 'anthropic-claude', family: 'anthropic' })
  }
  if (keysStore.value.gemini?.key) {
    models.push({ label: 'Gemini Vision', value: 'gemini-pro', family: 'gemini' })
  }
  if (keysStore.value.minimax?.key) {
    models.push({ label: 'MiniMax Vision', value: 'minimax', family: 'minimax' })
  }
  
  return models
})

watch(visionModels, (newModels) => {
  if (newModels.length > 0 && !visionModel.value && newModels[0]) {
    visionModel.value = newModels[0].value
  }
}, { immediate: true })
</script>

<template>
  <SettingsCard :title="t('settings.sandbox.sandbox')">
    <div class="space-y-4">
      <UFormGroup :label="t('settings.sandbox.enable')">
        <UToggle v-model="sandboxEnabled" />
      </UFormGroup>

      <UFormGroup :label="t('settings.sandbox.autoScreenshot')">
        <UToggle v-model="autoScreenshot" :disabled="!sandboxEnabled" />
      </UFormGroup>

      <UFormGroup :label="t('settings.sandbox.visionModel')">
        <USelect
          v-model="visionModel"
          :options="visionModels"
          option-label="label"
          option-value="value"
          :placeholder="t('settings.sandbox.selectVisionModel')"
          :disabled="!sandboxEnabled || visionModels.length === 0"
        />
        <p v-if="visionModels.length === 0 && sandboxEnabled" class="text-xs text-orange-500 mt-1">
          {{ t('settings.sandbox.noVisionModels') }}
        </p>
      </UFormGroup>

      <UFormGroup :label="t('settings.sandbox.includeConsole')">
        <UToggle v-model="includeConsole" :disabled="!sandboxEnabled" />
      </UFormGroup>
    </div>
  </SettingsCard>
</template>
