import { useStorage } from '@vueuse/core'
import type { ContextKeys } from '~/server/middleware/keys'

export interface SkillConfigs {
  [skillName: string]: Record<string, string | boolean>
}

const STORAGE_KEY = 'skill-configs'

const defaultConfigs: SkillConfigs = {}

export const skillConfigsStore = useStorage<SkillConfigs>(STORAGE_KEY, defaultConfigs)

export function getSkillConfigs(): SkillConfigs {
  return skillConfigsStore.value
}

export function getSkillConfig(skillName: string): Record<string, string | boolean> | undefined {
  return skillConfigsStore.value[skillName]
}

export function setSkillConfig(skillName: string, config: Record<string, string | boolean>): void {
  skillConfigsStore.value = {
    ...skillConfigsStore.value,
    [skillName]: config
  }
}

export function clearSkillConfig(skillName: string): void {
  const newConfigs = { ...skillConfigsStore.value }
  delete newConfigs[skillName]
  skillConfigsStore.value = newConfigs
}

export function getSkillConfigsHeader(): { 'x-skill-configs': string } {
  const configs = skillConfigsStore.value
  console.log('[SkillConfigs] getSkillConfigsHeader called, configs:', JSON.stringify(configs))
  const hasConfigs = Object.keys(configs).some(key => 
    configs[key] && Object.keys(configs[key]).length > 0
  )
  
  if (!hasConfigs) {
    console.log('[SkillConfigs] No configs found, returning empty')
    return { 'x-skill-configs': encodeURIComponent(JSON.stringify({})) }
  }
  
  console.log('[SkillConfigs] Returning configs:', configs)
  return { 'x-skill-configs': encodeURIComponent(JSON.stringify(configs)) }
}

export async function loadSkillConfigFromServer(skillName: string): Promise<Record<string, string | boolean> | null> {
  try {
    const response = await $fetchWithAuth<{ schema: any; userConfig: Record<string, string | boolean> }>(`/api/skills/config/${skillName}`)
    if (response.userConfig && Object.keys(response.userConfig).length > 0) {
      setSkillConfig(skillName, response.userConfig)
      return response.userConfig
    }
    return null
  } catch (e) {
    console.error(`Failed to load skill config for ${skillName}`, e)
    return null
  }
}

export async function saveSkillConfigToServer(skillName: string, config: Record<string, string | boolean>): Promise<boolean> {
  setSkillConfig(skillName, config)
  
  try {
    await $fetchWithAuth(`/api/skills/config/${skillName}`, {
      method: 'PUT',
      body: { config }
    })
    return true
  } catch (e: any) {
    if (e.status === 401) {
      console.log('User not logged in - config saved to localStorage only')
      return true
    }
    console.error(`Failed to save skill config for ${skillName}`, e)
    return false
  }
}