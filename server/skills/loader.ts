import fs from 'fs'
import path from 'path'
import { parseSkillMetadata, parseSkillInstructions, type Skill, type SkillConfigSchema, type SkillConfig } from './types'
import { tool } from '@langchain/core/tools'
import type { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

const globalSkillConfigs: Map<string, Record<string, string | boolean>> = new Map()

export function setSkillConfigs(configs: Record<string, Record<string, string | boolean>>): void {
  globalSkillConfigs.clear()
  for (const [skillName, config] of Object.entries(configs)) {
    globalSkillConfigs.set(skillName, config)
  }
}

export function getSkillConfig(skillName: string): Record<string, string | boolean> | undefined {
  return globalSkillConfigs.get(skillName)
}

function loadConfigSchema(skillPath: string): SkillConfigSchema | undefined {
  const configFile = path.join(skillPath, 'config.json')
  if (!fs.existsSync(configFile)) {
    return undefined
  }
  try {
    const content = fs.readFileSync(configFile, 'utf-8')
    return JSON.parse(content) as SkillConfigSchema
  } catch (error) {
    console.error(`[SkillLoader] Failed to parse config.json for ${skillPath}:`, error)
    return undefined
  }
}

export class SkillLoader {
  private skills: Map<string, Skill> = new Map()
  private loaded = false

  async loadAll(force = false): Promise<Skill[]> {
    if (this.loaded && !force) {
      return Array.from(this.skills.values())
    }

    this.skills.clear()

    if (!fs.existsSync(SKILLS_DIR)) {
      console.log('[SkillLoader] Skills directory not found:', SKILLS_DIR)
      return []
    }

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = path.join(SKILLS_DIR, entry.name)
      const skill = await this.loadSkill(entry.name, skillPath)

      if (skill) {
        this.skills.set(skill.name, skill)
        console.log(`[SkillLoader] Loaded skill: ${skill.name}`)
      }
    }

    this.loaded = true
    return Array.from(this.skills.values())
  }

  async loadSkill(name: string, skillPath: string): Promise<Skill | null> {
    const skillFile = path.join(skillPath, 'SKILL.md')

    if (!fs.existsSync(skillFile)) {
      console.warn(`[SkillLoader] SKILL.md not found for skill: ${name}`)
      return null
    }

    const content = fs.readFileSync(skillFile, 'utf-8')
    const metadata = parseSkillMetadata(content)

    if (!metadata) {
      console.warn(`[SkillLoader] Invalid SKILL.md format for: ${name}`)
      return null
    }

    const tools = await this.loadTools(skillPath)
    const configSchema = loadConfigSchema(skillPath)

    return {
      name: metadata.name,
      description: metadata.description,
      path: skillPath,
      instructions: parseSkillInstructions(content),
      tools,
      icon: metadata.icon,
      examples: metadata.examples,
      configSchema
    }
  }

  private async loadTools(skillPath: string): Promise<DynamicStructuredTool[]> {
    const possibleFiles = [
      path.join(skillPath, 'tools.mjs'),
      path.join(skillPath, 'tools.js'),
      path.join(skillPath, 'tools.ts'),
    ]

    let toolsFile: string | undefined
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        toolsFile = file
        break
      }
    }

    if (!toolsFile) {
      return []
    }

    try {
      const toolsModule = await import(toolsFile)
      const plainTools = toolsModule.default || toolsModule.tools || []
      const skillName = path.basename(skillPath)

      return plainTools.map((t: any) => {
        if (t.name && t.description && t.execute) {
          const originalExecute = t.execute
          const wrappedExecute = async function(input: any, runtimeConfig?: any) {
            const skillConfig = globalSkillConfigs.get(skillName)
            console.log(`[SkillTool] ${skillName} executing, config:`, skillConfig)
            return originalExecute(input, skillConfig)
          }
          return tool(wrappedExecute, {
            name: t.name,
            description: t.description,
            schema: t.schema || z.object({}),
          })
        }
        return t
      })
    } catch (error) {
      console.error(`[SkillLoader] Failed to load tools for ${skillPath}:`, error)
      return []
    }
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  getEnabledSkills(enabledSkills: string[]): Skill[] {
    if (!enabledSkills || enabledSkills.length === 0) {
      return []
    }

    return this.getAllSkills().filter(skill =>
      enabledSkills.includes(skill.name)
    )
  }

  getAllTools(skillNames?: string[]): DynamicStructuredTool[] {
    if (!skillNames || skillNames.length === 0) {
      return []
    }

    const skills = this.getEnabledSkills(skillNames)

    return skills.flatMap(skill => skill.tools)
  }

  getSystemPrompt(skillNames: string[]): string {
    const skills = this.getEnabledSkills(skillNames)

    if (skills.length === 0) {
      return ''
    }

    return skills.map(skill => skill.instructions).join('\n\n')
  }

  getConfigSchema(skillName: string): SkillConfigSchema | undefined {
    const skill = this.skills.get(skillName)
    return skill?.configSchema
  }

  getAllConfigSchemas(): Map<string, SkillConfigSchema> {
    const schemas = new Map<string, SkillConfigSchema>()
    for (const [name, skill] of this.skills) {
      if (skill.configSchema) {
        schemas.set(name, skill.configSchema)
      }
    }
    return schemas
  }
}

export const skillLoader = new SkillLoader()
