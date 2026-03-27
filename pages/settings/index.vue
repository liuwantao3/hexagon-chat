<script setup lang="ts">
import { SkillConfigModal } from '#components'

const configureSkillName = ref<string | null>(null)
const configureSkillTitle = ref('')

const onConfigureSkill = (skillName: string, title: string) => {
  configureSkillName.value = skillName
  configureSkillTitle.value = title
}

const closeConfigureSkill = () => {
  configureSkillName.value = null
  configureSkillTitle.value = ''
}
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-4">
      <SettingsServers />
    </div>
    <div class="mb-4">
      <SettingsSandbox />
    </div>
    <div class="mb-4">
      <SettingsLanguageSelectMenu />
    </div>
    <div class="mb-4">
      <ClientOnly>
        <SkillSettings @configure="onConfigureSkill" />
      </ClientOnly>
    </div>
    
    <ClientOnly>
      <SkillConfigModal
        v-if="configureSkillName"
        :skill-name="configureSkillName"
        :skill-title="configureSkillTitle"
        @close="closeConfigureSkill"
      />
    </ClientOnly>
  </div>
</template>
