<script setup lang="ts">
import type { MarketplaceSkill } from '~/server/skills/marketplace'

const props = defineProps<{
  onClose: () => void
  onInstall: (skillName: string) => void
}>()

const emit = defineEmits<{
  configure: [skillName: string, title: string]
}>()

const searchQuery = ref('')
const searchResults = ref<MarketplaceSkill[]>([])
const isSearching = ref(false)
const error = ref('')
const installedSkills = ref<string[]>([])
const skillConfigSchemas = ref<Record<string, boolean>>({})

const categoryColors: Record<string, string> = {
  langchain: 'blue',
  anthropic: 'green',
  mcp: 'purple',
  custom: 'gray',
}

const languageColors: Record<string, string> = {
  python: 'yellow',
  typescript: 'blue',
  javascript: 'amber',
  any: 'gray',
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  error.value = ''

  try {
    const res = await $fetch<{ skills: MarketplaceSkill[] }>(`/api/skills/marketplace/search?q=${encodeURIComponent(searchQuery.value)}`)
    searchResults.value = res.skills.map(skill => ({
      ...skill,
      installed: installedSkills.value.includes(skill.name),
    }))
  } catch (e: any) {
    error.value = e.message || 'Search failed'
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const installSkill = async (skill: MarketplaceSkill) => {
  if (!skill.url) return

  try {
    const result = await $fetch<{ success: boolean; message: string }>('/api/skills/marketplace/install', {
      method: 'POST',
      body: {
        url: skill.url,
        name: skill.name,
      },
    })

    if (result.success) {
      skill.installed = true
      if (!installedSkills.value.includes(skill.name)) {
        installedSkills.value.push(skill.name)
      }
      props.onInstall(skill.name)
    } else {
      error.value = result.message || 'Installation failed'
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Installation failed'
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    props.onClose()
  } else if (e.key === 'Enter' && !isSearching.value) {
    performSearch()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  
  try {
    const { skills: localSkills } = await $fetch<{ skills: { name: string }[] }>('/api/skills')
    installedSkills.value = localSkills.map(s => s.name)
    
    for (const skill of localSkills) {
      try {
        await $fetch(`/api/skills/config/${skill.name}`)
        skillConfigSchemas.value[skill.name] = true
      } catch {
        skillConfigSchemas.value[skill.name] = false
      }
    }
  } catch (e) {
    console.error('Failed to load installed skills', e)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="onClose">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div>
          <h2 class="text-lg font-semibold">Skill Marketplace</h2>
          <p class="text-xs text-gray-500">Install skills from Anthropic and LangChain</p>
        </div>
        <UButton icon="i-heroicons-x-mark" variant="ghost" @click="onClose" />
      </div>

      <!-- Search -->
      <div class="p-4 border-b dark:border-gray-700">
        <div class="flex gap-2">
          <UInput
            v-model="searchQuery"
            placeholder="Search skills (e.g., 'langgraph', 'pdf', 'mcp')"
            class="flex-1"
            @keydown.enter="performSearch"
          />
          <UButton
            :loading="isSearching"
            @click="performSearch"
          >
            Search
          </UButton>
        </div>
      </div>

      <!-- Results -->
      <div class="p-4 overflow-y-auto max-h-[55vh]">
        <div v-if="error" class="text-red-500 text-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {{ error }}
        </div>

        <div v-if="searchResults.length === 0 && !isSearching && searchQuery" class="text-center text-gray-500 py-8">
          No skills found. Try a different search term.
        </div>

        <div v-else-if="searchResults.length > 0" class="space-y-3">
          <div
            v-for="skill in searchResults"
            :key="skill.name"
            class="flex items-start gap-3 p-4 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium">{{ skill.name }}</span>
                
                <!-- Category Badge -->
                <UBadge
                  v-if="skill.category"
                  :color="categoryColors[skill.category] || 'gray'"
                  size="xs"
                  variant="subtle"
                >
                  {{ skill.category }}
                </UBadge>

                <!-- Source Badge -->
                <UBadge color="gray" size="xs" variant="subtle">
                  {{ skill.source }}
                </UBadge>

                <!-- Tool Availability Badge -->
                <UBadge
                  v-if="skill.hasTools"
                  color="orange"
                  size="xs"
                  variant="subtle"
                >
                  Has Tools
                </UBadge>
                <UBadge
                  v-else
                  color="gray"
                  size="xs"
                  variant="subtle"
                >
                  Instructions Only
                </UBadge>

                <!-- Language Badge -->
                <UBadge
                  v-if="skill.language"
                  :color="languageColors[skill.language] || 'gray'"
                  size="xs"
                  variant="outline"
                >
                  {{ skill.language }}
                </UBadge>
              </div>

              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {{ skill.description }}
              </p>

              <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>by {{ skill.author }}</span>
                <a
                  v-if="skill.url"
                  :href="skill.url"
                  target="_blank"
                  class="text-primary-500 hover:underline flex items-center gap-1"
                >
                  View on GitHub
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
                </a>
              </div>

              <!-- Note for MCP skills -->
              <div v-if="skill.category === 'mcp'" class="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-700 dark:text-purple-300">
                <UIcon name="i-heroicons-light-bulb" class="w-4 h-4 inline mr-1" />
                MCP skills include templates for building tools in Python or TypeScript
              </div>
            </div>

            <div class="flex-shrink-0">
              <UButton
                v-if="!skill.installed"
                @click="installSkill(skill)"
              >
                Install
              </UButton>
              <div v-else class="flex items-center gap-2">
                <UBadge color="green" size="sm">
                  Installed
                </UBadge>
                <UButton
                  v-if="skillConfigSchemas[skill.name]"
                  size="xs"
                  variant="outline"
                  icon="i-heroicons-cog-6-tooth"
                  @click="emit('configure', skill.name, skill.name)"
                >
                  Configure
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-arrow-path"
                  @click="installSkill(skill)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center text-gray-500 py-8">
          <UIcon name="i-heroicons-magnifying-glass" class="text-4xl mb-2" />
          <p>Search for skills to install</p>
          <p class="text-sm mt-1">Try: langgraph, mcp, pdf, document</p>
        </div>
      </div>
    </div>
  </div>
</template>
