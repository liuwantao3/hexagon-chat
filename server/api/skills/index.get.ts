import { skillLoader } from '@/server/skills'
import { KNOWN_SKILLS } from '@/server/skills/marketplace'

export default defineEventHandler(async () => {
  await skillLoader.loadAll()

  const localSkills = skillLoader.getAllSkills()
  const localSkillNames = new Set(localSkills.map(s => s.name))

  const localSkillMeta = localSkills.map(skill => ({
    name: skill.name,
    description: skill.description,
    icon: skill.icon || '📦',
    examples: skill.examples || [],
    hasTools: skill.tools.length > 0,
    installed: true,
    source: 'local' as const,
    category: getCategoryForSkill(skill.name),
    language: getLanguageForSkill(skill.name),
  }))

  const availableSkills = KNOWN_SKILLS.filter(s => !localSkillNames.has(s.name))
    .map(s => ({
      name: s.name,
      description: s.description,
      icon: s.icon || '📦',
      examples: s.examples || [],
      hasTools: s.hasTools || false,
      installed: false,
      source: s.source,
      category: s.category,
      language: s.language,
    }))

  return {
    skills: [...localSkillMeta, ...availableSkills],
    localSkills: localSkillMeta,
    availableSkills,
  }
})

function getCategoryForSkill(name: string): string {
  if (name.includes('langgraph')) return 'langchain'
  if (name.includes('langchain')) return 'langchain'
  if (name.includes('mcp')) return 'mcp'
  return 'custom'
}

function getLanguageForSkill(name: string): string {
  if (name.includes('python')) return 'python'
  if (name.includes('typescript') || name.includes('ts')) return 'typescript'
  return 'any'
}
