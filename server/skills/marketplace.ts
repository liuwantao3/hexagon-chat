export interface MarketplaceSkill {
  name: string
  description: string
  author?: string
  source: 'github' | 'lobehub' | 'local'
  url?: string
  category?: 'anthropic' | 'langchain' | 'mcp' | 'custom'
  stars?: number
  installed?: boolean
  hasTools?: boolean
  hasConfig?: boolean
  language?: 'python' | 'typescript' | 'javascript' | 'any'
  icon?: string
  examples?: string[]
}

export interface MarketplaceConfig {
  sources: Array<{
    name: string
    type: 'github' | 'lobehub'
    url: string
  }>
}

const DEFAULT_CONFIG: MarketplaceConfig = {
  sources: [
    {
      name: 'Anthropic Official',
      type: 'github',
      url: 'https://github.com/anthropics/skills',
    },
    {
      name: 'LangChain',
      type: 'github',
      url: 'https://github.com/langchain-ai/langchain-skills',
    },
  ],
}

const KNOWN_SKILLS: MarketplaceSkill[] = [
  // LangChain Skills - Fully compatible with your project
  {
    name: 'langgraph-project-setup',
    description: 'Initialize LangGraph projects with proper structure and configuration. Supports Python and TypeScript.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langgraph-project-setup',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langgraph-agent-patterns',
    description: 'Multi-agent coordination patterns for LangGraph: supervisor, router, orchestrator, and handoffs.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langgraph-agent-patterns',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langgraph-error-handling',
    description: 'Error handling, retry patterns, and graceful degradation for LangGraph applications.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langgraph-error-handling',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langgraph-deployment',
    description: 'Deploy LangGraph applications to production with Docker, Kubernetes, and cloud platforms.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langgraph-deployment',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langchain-fundamentals',
    description: 'Core LangChain concepts: create_agent, @tool decorator, and middleware patterns.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langchain-fundamentals',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langchain-rag',
    description: 'Retrieval-Augmented Generation patterns with LangChain: loaders, splitters, vector stores.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langchain-rag',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },
  {
    name: 'langgraph-human-in-the-loop',
    description: 'Human-in-the-loop patterns with interrupt, approval workflows, and Command patterns.',
    author: 'langchain-ai/langchain-skills',
    source: 'github',
    url: 'https://github.com/langchain-ai/langchain-skills/tree/main/skills/langgraph-human-in-the-loop',
    category: 'langchain',
    hasTools: false,
    language: 'any',
  },

  // MCP Builder Skill - For creating tools in any language
  {
    name: 'mcp-builder',
    description: 'Build MCP (Model Context Protocol) servers in Python or TypeScript. Create reusable tools for any language.',
    author: 'anthropics',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/mcp-builder',
    category: 'mcp',
    hasTools: false,
    language: 'any',
  },

  // Anthropic Document Skills
  {
    name: 'pdf-editor',
    description: 'Edit, extract, and manipulate PDF files. Extract text, merge, split, rotate, and more.',
    author: 'anthropics/skills',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
    category: 'anthropic',
    hasTools: true,
    language: 'python',
  },
  {
    name: 'docx-editor',
    description: 'Create and edit Word documents. Supports tracked changes, comments, and formatting.',
    author: 'anthropics/skills',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/docx',
    category: 'anthropic',
    hasTools: true,
    language: 'python',
  },
  {
    name: 'pptx-maker',
    description: 'Create professional PowerPoint presentations with proper layouts and themes.',
    author: 'anthropics/skills',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/pptx',
    category: 'anthropic',
    hasTools: true,
    language: 'python',
  },
  {
    name: 'xlsx-analyst',
    description: 'Analyze and work with Excel spreadsheets. Data manipulation, formulas, and charts.',
    author: 'anthropics/skills',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/xlsx',
    category: 'anthropic',
    hasTools: true,
    language: 'python',
  },
  {
    name: 'image-generator',
    description: 'Generate algorithmic art using p5.js. Create unique visualizations and graphics.',
    author: 'anthropics/skills',
    source: 'github',
    url: 'https://github.com/anthropics/skills/tree/main/skills/algorithmic-art',
    category: 'anthropic',
    hasTools: true,
    language: 'javascript',
  },
]

export class MarketplaceService {
  private config: MarketplaceConfig

  constructor(config: MarketplaceConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  async search(query: string): Promise<MarketplaceSkill[]> {
    const lowerQuery = query.toLowerCase()
    const results: MarketplaceSkill[] = []

    for (const skill of KNOWN_SKILLS) {
      if (this.matchesQuery(skill.name, skill.description, lowerQuery)) {
        results.push({ ...skill })
      }
    }

    return results
  }

  async installFromUrl(skillUrl: string, skillName: string): Promise<{ success: boolean; message: string }> {
    const match = skillUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/skills\/([^\/]+)/)
    if (!match) {
      return { success: false, message: 'Invalid GitHub URL format' }
    }

    const [, owner, repo, branch = 'main', name] = match
    const skillDir = `skills/${name}`

    try {
      const fs = await import('fs')
      const pathModule = await import('path')
      const targetDir = pathModule.join(process.cwd(), skillDir)

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      const skillInfo = KNOWN_SKILLS.find(s => s.name === name)
      const filesToFetch: Array<{ url: string; filename: string }> = [
        { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${name}/SKILL.md`, filename: 'SKILL.md' },
      ]

      if (skillInfo?.category === 'mcp') {
        filesToFetch.push(
          { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${name}/README.md`, filename: 'README.md' },
          { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${name}/template.py`, filename: 'template.py' },
          { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${name}/template.ts`, filename: 'template.ts' },
        )
      }

      const results: string[] = []
      for (const file of filesToFetch) {
        try {
          const response = await fetch(file.url)
          if (response.ok) {
            const content = await response.text()
            fs.writeFileSync(pathModule.join(targetDir, file.filename), content)
            results.push(file.filename)
          }
        } catch (e) {
          console.warn(`[Marketplace] Could not fetch ${file.filename}:`, e)
        }
      }

      if (results.length === 0) {
        return { success: false, message: 'Failed to fetch skill files' }
      }

      console.log(`[Marketplace] Installed skill "${name}" with files: ${results.join(', ')}`)
      return { success: true, message: `Installed ${results.length} files to ${skillDir}` }
    } catch (error: any) {
      console.error('[Marketplace] Installation failed:', error)
      return { success: false, message: error.message || 'Installation failed' }
    }
  }

  private parseSkillMetadata(content: string): { name: string; description: string } | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const yaml = frontmatterMatch[1]
    const nameMatch = yaml.match(/name:\s*(.+)/)
    const descMatch = yaml.match(/description:\s*(.+)/)

    if (!nameMatch || !descMatch) return null

    return {
      name: nameMatch[1].trim(),
      description: descMatch[1].trim(),
    }
  }

  private matchesQuery(name: string, description: string, query: string): boolean {
    return (
      name.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query)
    )
  }
}

export const marketplaceService = new MarketplaceService()
export { KNOWN_SKILLS }
