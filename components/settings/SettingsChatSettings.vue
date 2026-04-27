<script lang="ts" setup>

const { t } = useI18n()

</script>

<template>
  <ClientOnly>
    <SettingsCard :title="t('settings.chatSettings')">
      <UFormGroup :label="t('settings.defaultModel')" class="mb-4">
        <ModelsMultiSelectMenu v-model="chatDefaultSettings.models" size="lg"></ModelsMultiSelectMenu>
      </UFormGroup>
      <UFormGroup :label="t('settings.contextWindowSize')">
        <div class="flex items-center">
          <span class="mr-2 w-6 text-primary-500">{{ chatDefaultSettings.contextWindowSize }}</span>
          <URange v-model="chatDefaultSettings.contextWindowSize" :min="5" :max="50" size="md" />
        </div>
      </UFormGroup>
    </SettingsCard>
  </ClientOnly>
</template>
