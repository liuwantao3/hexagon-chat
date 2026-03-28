<script setup lang="ts">
import { getSkillConfig, loadSkillConfigFromServer } from '~/composables/useSkillConfigs'
import { SettingsCard } from '#components'

const emit = defineEmits<{
  configure: [skillName: string, title: string]
}>()

const loading = ref(true)
const skillsWithConfig = ref<{ name: string; hasConfig: boolean }[]>([])

onMounted(async () => {
  try {
    const { skills } = await $fetch<{ skills: { name: string; description: string; icon?: string }[] }>('/api/skills')
    
    skillsWithConfig.value = skills.map(skill => ({ name: skill.name, hasConfig: false }))
  } catch (e) {
    console.error('Failed to load skills', e)
  } finally {
    loading.value = false
  }
})

function isConfigured(skillName: string): boolean {
  const config = getSkillConfig(skillName)
  return config !== undefined && Object.keys(config).length > 0
}
</script>

<template>
  <SettingsCard title="Skill Settings" subtitle="Configure installed skills">
    <div v-if="loading" class="flex justify-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-xl" />
    </div>
    
    <div v-else-if="skillsWithConfig.length === 0" class="text-gray-500 text-sm py-4 text-center">
      No skills with configuration available
    </div>
    
    <div v-else class="space-y-2">
      <div
        v-for="skill in skillsWithConfig"
        :key="skill.name"
        class="flex items-center justify-between p-3 rounded-lg border dark:border-gray-700"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
            <UIcon name="i-heroicons-cog-6-tooth" class="text-primary-500" />
          </div>
          <div>
            <div class="font-medium">{{ skill.name }}</div>
            <div class="text-xs text-gray-500">
              {{ isConfigured(skill.name) ? 'Configured' : 'Not configured' }}
            </div>
          </div>
        </div>
        
        <UButton
          size="sm"
          :variant="isConfigured(skill.name) ? 'outline' : 'solid'"
          @click="emit('configure', skill.name, skill.name)"
        >
          {{ isConfigured(skill.name) ? 'Edit' : 'Configure' }}
        </UButton>
      </div>
    </div>
  </SettingsCard>
</template>