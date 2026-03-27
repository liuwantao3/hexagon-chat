import fs from 'fs'
import path from 'path'
import { parseSkillMetadata, parseSkillInstructions, type Skill, type SkillConfig } from './types'
import { tool } from '@langchain/core/tools'
import type { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

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

    return {
      name: metadata.name,
      description: metadata.description,
      path: skillPath,
      instructions: parseSkillInstructions(content),
      tools,
      icon: metadata.icon,
      examples: metadata.examples
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

      return plainTools.map((t: any) => {
        if (t.name && t.description && t.execute) {
          return tool(t.execute, {
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
}

export const skillLoader = new SkillLoader()
