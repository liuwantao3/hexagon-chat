import type { DynamicStructuredTool } from '@langchain/core/tools'

export interface SkillConfigField {
  key: string
  type: 'password' | 'text' | 'select' | 'toggle'
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
  default?: string | boolean
}

export interface SkillConfigSchema {
  fields: SkillConfigField[]
}

export interface SkillConfig {
  name: string
  description: string
  enabled?: boolean
  icon?: string
  tools?: DynamicStructuredTool[]
  systemPrompt?: string
  examples?: string[]
  configSchema?: SkillConfigSchema
}

export interface Skill {
  name: string
  description: string
  path: string
  instructions: string
  tools: DynamicStructuredTool[]
  icon?: string
  examples?: string[]
  configSchema?: SkillConfigSchema
}

export interface SkillMetadata {
  name: string
  description: string
  icon?: string
  examples?: string[]
}

export function parseSkillMetadata(content: string): SkillMetadata | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return null

  const yaml = frontmatterMatch[1]
  const metadata: Record<string, string | string[]> = {}

  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = value.slice(1, -1).split(',').map(s => s.trim())
    } else {
      metadata[key] = value
    }
  }

  return {
    name: metadata.name as string,
    description: metadata.description as string,
    icon: metadata.icon as string | undefined,
    examples: metadata.examples as string[] | undefined
  }
}

export function parseSkillInstructions(content: string): string {
  const frontmatterEnd = content.indexOf('---', 4)
  if (frontmatterEnd === -1) return content.trim()

  const afterFrontmatter = content.slice(frontmatterEnd + 3)
  return afterFrontmatter.trim()
}
