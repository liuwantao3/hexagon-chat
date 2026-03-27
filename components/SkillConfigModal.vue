<script setup lang="ts">
import { loadSkillConfigFromServer, saveSkillConfigToServer, getSkillConfig } from '~/composables/useSkillConfigs'

const props = defineProps<{
  skillName: string
  skillTitle: string
  onClose: () => void
  onSaved?: () => void
}>()

interface ConfigField {
  key: string
  type: 'password' | 'text' | 'select' | 'toggle'
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
  default?: string | boolean
}

interface ConfigSchema {
  fields: ConfigField[]
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const schema = ref<ConfigSchema | null>(null)
const formData = reactive<Record<string, string | boolean>>({})

onMounted(async () => {
  try {
    const localConfig = getSkillConfig(props.skillName)
    
    const response = await $fetchWithAuth<{ schema: ConfigSchema; userConfig: Record<string, string | boolean> }>(
      `/api/skills/config/${props.skillName}`
    )
    
    schema.value = response.schema
    
    if (response.userConfig && Object.keys(response.userConfig).length > 0) {
      Object.assign(formData, response.userConfig)
    } else if (localConfig && Object.keys(localConfig).length > 0) {
      Object.assign(formData, localConfig)
    } else {
      for (const field of schema.value.fields) {
        if (field.default !== undefined) {
          formData[field.key] = field.default
        }
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load config schema'
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  if (!schema.value) return
  
  const requiredFields = schema.value.fields.filter(f => f.required)
  for (const field of requiredFields) {
    if (!formData[field.key]) {
      error.value = `Please fill in required field: ${field.label}`
      return
    }
  }
  
  saving.value = true
  error.value = ''
  
  try {
    const success = await saveSkillConfigToServer(props.skillName, { ...formData })
    if (success) {
      props.onSaved?.()
      props.onClose()
    } else {
      error.value = 'Failed to save configuration'
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to save configuration'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
    <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
      <span class="font-semibold">Configure {{ skillTitle }}</span>
      <UButton icon="i-material-symbols-close-rounded" color="gray" size="sm" @click="onClose()"></UButton>
    </div>
    
    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl" />
    </div>
    
    <div v-else-if="error && !schema" class="text-red-500 p-4">
      {{ error }}
    </div>
    
    <UForm v-else-if="schema" :state="formData" class="p-4 space-y-4">
      <template v-for="field in schema.fields" :key="field.key">
        <UFormGroup 
          :label="field.label" 
          :name="field.key"
          :required="field.required"
        >
          <UInput
            v-if="field.type === 'text'"
            v-model="formData[field.key]"
            :placeholder="field.placeholder"
          />
          <UInput
            v-else-if="field.type === 'password'"
            v-model="formData[field.key]"
            :placeholder="field.placeholder"
            type="password"
            autocomplete="off"
          />
          <USelectMenu
            v-else-if="field.type === 'select' && field.options"
            v-model="formData[field.key]"
            :options="field.options"
          />
          <UToggle
            v-else-if="field.type === 'toggle'"
            v-model="formData[field.key]"
          />
        </UFormGroup>
      </template>
      
      <div v-if="error" class="text-red-500 text-sm mt-2">
        {{ error }}
      </div>
    </UForm>
    
    <div class="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
      <UButton color="gray" @click="onClose">Cancel</UButton>
      <UButton 
        :loading="saving" 
        @click="handleSave"
      >
        Save
      </UButton>
    </div>
  </div>
</template>