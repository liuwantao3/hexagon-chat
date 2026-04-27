import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

export interface SessionToSummarize {
  sessionId: number
  title: string
  messages: Array<{
    role: string
    content: string
  }>
}

export interface WikiEntity {
  name: string
  slug: string
  category: string
  pageContent: string
  summary: string
  tags: string[]
  confidence: number
}

export interface WikiDecision {
  title: string
  slug: string
  pageContent: string
  summary: string
  tags: string[]
}

export interface CrossReference {
  fromSlug: string
  toSlug: string
  type: 'uses' | 'related-to' | 'contradicts' | 'elaborates' | 'supersedes'
  context: string
}

export interface WikiIngestResult {
  sessionId: number
  sessionSummary: {
    title: string
    content: string
    tags: string[]
    confidence: number
  }
  entities: WikiEntity[]
  decisions: WikiDecision[]
  crossReferences: CrossReference[]
  keyDiscoveries: string[]
  isInvestigation: boolean
  depth: 'casual' | 'detailed' | 'deep-investigation'
}

class SummarizerService {
  private getLLM(model: string): BaseChatModel {
    const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY

    if (process.env.MINIMAX_API_KEY) {
      console.log('[Summarizer] Using model:', model, 'with MiniMax endpoint')
      return new ChatOpenAI({
        model,
        temperature: 0.3,
        apiKey,
        configuration: {
          baseURL: 'https://api.minimax.chat/v1'
        }
      })
    }

    console.log('[Summarizer] Using model:', model, 'with default endpoint')
    return new ChatOpenAI({
      model,
      temperature: 0.3,
      apiKey
    })
  }

  private getSkillTemplate(): string {
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      const skillPath = join(__dirname, '../../skills/wiki-ingest/SKILL.md')
      return readFileSync(skillPath, 'utf-8')
    } catch (error) {
      console.warn('[Summarizer] Could not load wiki-ingest skill template, using fallback')
      return ''
    }
  }

  private extractJSONFromResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      try {
        const cleaned = content.replace(/[\x00-\x1F\x7F]/g, '')
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e2) {
        console.warn('[Summarizer] JSON parse failed after cleaning:', e2)
      }
    }
    return null
  }

  async summarizeSession(session: SessionToSummarize, model = 'MiniMax-M2.5'): Promise<WikiIngestResult> {
    console.log(`[Summarizer] Analyzing session ${session.sessionId}: ${session.title} with model ${model}`)

    const conversationParts = session.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role}: ${String(m.content).substring(0, 1000)}`)
      .join('\n\n')

    const skillTemplate = this.getSkillTemplate()

    const prompt = skillTemplate || this.getFallbackPrompt()

    try {
      const llm = this.getLLM(model)
      const response = await llm.invoke(prompt.replace('{{CONVERSATION}}', conversationParts))
      const content = typeof response === 'string' ? response : response.content

      const parsed = this.extractJSONFromResponse(content)

      if (!parsed) {
        console.warn('[Summarizer] No JSON found in response, creating minimal result')
        return this.createMinimalResult(session.sessionId)
      }

      return {
        sessionId: session.sessionId,
        sessionSummary: {
          title: parsed.sessionSummary?.title || session.title,
          content: parsed.sessionSummary?.content || '',
          tags: parsed.sessionSummary?.tags || [],
          confidence: parsed.sessionSummary?.confidence || 0.5
        },
        entities: (parsed.entities || []).map((e: any) => ({
          name: e.name || 'Unknown',
          slug: e.slug || this.generateSlug(e.name || 'unknown'),
          category: e.category || 'concept',
          pageContent: e.pageContent || e.description || '',
          summary: e.summary || e.description?.substring(0, 100) || '',
          tags: e.tags || [],
          confidence: e.confidence || 0.5
        })),
        decisions: (parsed.decisions || []).map((d: any) => ({
          title: d.title || 'Untitled Decision',
          slug: d.slug || this.generateSlug(d.title || 'untitled'),
          pageContent: d.pageContent || d.rationale || '',
          summary: d.summary || d.title || '',
          tags: d.tags || []
        })),
        crossReferences: (parsed.crossReferences || []).map((r: any) => ({
          fromSlug: r.fromSlug,
          toSlug: r.toSlug,
          type: r.type || 'related-to',
          context: r.context || ''
        })),
        keyDiscoveries: parsed.keyDiscoveries || [],
        isInvestigation: parsed.isInvestigation || false,
        depth: parsed.depth || 'casual'
      }
    } catch (error) {
      console.error('[Summarizer] Error analyzing session:', error)
      return this.createMinimalResult(session.sessionId)
    }
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)
  }

  private createMinimalResult(sessionId: number): WikiIngestResult {
    return {
      sessionId,
      sessionSummary: {
        title: 'Session Summary',
        content: 'Error generating summary',
        tags: [],
        confidence: 0
      },
      entities: [],
      decisions: [],
      crossReferences: [],
      keyDiscoveries: [],
      isInvestigation: false,
      depth: 'casual'
    }
  }

  private getFallbackPrompt(): string {
    return `Analyze this conversation and generate wiki content.

Conversation:
{{CONVERSATION}}

Respond in JSON format:
{
  "sessionSummary": {
    "title": "Session title",
    "content": "## Overview\\n\\nDetailed markdown...",
    "tags": ["tag1", "tag2"],
    "confidence": 0.8
  },
  "entities": [
    {
      "name": "Entity Name",
      "slug": "entity-name",
      "category": "framework",
      "pageContent": "# Entity Name\\n\\n## What It Is\\n\\nDescription...",
      "summary": "One-line description",
      "tags": [],
      "confidence": 0.8
    }
  ],
  "decisions": [
    {
      "title": "Decision Made",
      "slug": "decision-made",
      "pageContent": "# Decision\\n\\n## Context\\n\\n...",
      "summary": "What was decided",
      "tags": []
    }
  ],
  "crossReferences": [
    {
      "fromSlug": "entity-a",
      "toSlug": "entity-b",
      "type": "uses",
      "context": "How they relate"
    }
  ],
  "keyDiscoveries": ["Discovery 1"],
  "isInvestigation": false,
  "depth": "casual"
}`
  }

  async saveSummary(userId: number, session: WikiIngestResult): Promise<void> {
    console.log(`[Summarizer] Wiki ingest result ready for session ${session.sessionId}`)
    console.log(`  - Entities: ${session.entities.length}`)
    console.log(`  - Decisions: ${session.decisions.length}`)
    console.log(`  - Cross-references: ${session.crossReferences.length}`)
    console.log(`  - Is investigation: ${session.isInvestigation}`)
  }
}

export const summarizerService = new SummarizerService()