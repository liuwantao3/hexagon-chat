import prisma from '../utils/prisma'
import { summarizerService, type WikiIngestResult, type WikiEntity, type WikiDecision, type CrossReference } from './summarizer'
import { createHash } from 'crypto'
import MiniSearch from 'minisearch'

export interface WikiPageInput {
  title: string
  slug: string
  content: string
  category: string
  summary?: string
  tags?: string[]
  confidence?: number
}

export interface WikiSearchQuery {
  userId: number
  query?: string
  category?: string
  limit?: number
  offset?: number
}

class WikiService {
  private searchIndex: MiniSearch | null = null
  private searchIndexUserId: number | null = null

  private async buildSearchIndex(userId: number): Promise<MiniSearch> {
    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        summary: true,
        category: true
      }
    })

    const miniSearch = new MiniSearch({
      fields: ['title', 'content', 'summary'],
      storeFields: ['slug', 'title', 'category', 'summary'],
      searchOptions: {
        boost: { title: 3, summary: 2, content: 1 },
        fuzzy: 0.2,
        prefix: true
      }
    })

    miniSearch.addAll(pages.map(p => ({
      id: String(p.id),
      slug: p.slug,
      title: p.title,
      content: p.content,
      summary: p.summary || '',
      category: p.category
    })))

    this.searchIndex = miniSearch
    this.searchIndexUserId = userId

    return miniSearch
  }

  private async getSearchIndex(userId: number): Promise<MiniSearch> {
    if (!this.searchIndex || this.searchIndexUserId !== userId) {
      await this.buildSearchIndex(userId)
    }
    return this.searchIndex!
  }

  async invalidateSearchIndex(userId: number): Promise<void> {
    if (this.searchIndexUserId === userId) {
      this.searchIndex = null
      this.searchIndexUserId = null
    }
  }
  async getOrCreateConfig(userId: number): Promise<any> {
    let config = await prisma.wikiConfig.findUnique({
      where: { userId }
    })

    if (!config) {
      config = await prisma.wikiConfig.create({
        data: {
          userId,
          enabled: true,
          autoIngest: true,
          ingestHours: 12,
          summarizerModel: 'MiniMax-M2.5'
        }
      })
    }

    return config
  }

  async updateConfig(userId: number, data: Partial<{
    enabled: boolean
    autoIngest: boolean
    ingestHours: number
    summarizerModel: string
    lastIngest: Date
    lastLint: Date
  }>): Promise<any> {
    return prisma.wikiConfig.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    })
  }

  async ingestSession(userId: number, session: {
    sessionId: number
    title: string
    messages: Array<{ role: string; content: string }>
  }): Promise<WikiIngestResult> {
    console.log(`[Wiki] Ingesting session ${session.sessionId} for user ${userId}`)

    const config = await this.getOrCreateConfig(userId)
    const model = config.summarizerModel || 'MiniMax-M2.5'

    const result = await summarizerService.summarizeSession(session, model)

    const source = await this.createOrGetSource(userId, {
      type: 'session',
      sessionId: session.sessionId,
      title: session.title,
      content: session.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    })

    await prisma.wikiSource.update({
      where: { id: source.id },
      data: { ingestedAt: new Date() }
    })

    await prisma.sessionSummary.upsert({
      where: { sessionId: session.sessionId },
      update: {
        userId,
        summary: result.sessionSummary.content.substring(0, 1000)
      },
      create: {
        userId,
        sessionId: session.sessionId,
        summary: result.sessionSummary.content.substring(0, 1000),
        goals: result.sessionSummary.tags?.join(', '),
        accomplishments: result.isInvestigation ? 'Investigation completed' : ''
      }
    })

    const pageIds: number[] = []

    const sessionPage = await this.createOrUpdatePage(userId, {
      title: result.sessionSummary.title,
      slug: `session-${session.sessionId}`,
      content: result.sessionSummary.content,
      category: 'summary',
      summary: result.sessionSummary.content.substring(0, 200),
      tags: result.sessionSummary.tags,
      confidence: result.sessionSummary.confidence
    })
    pageIds.push(sessionPage.id)

    for (const entity of result.entities) {
      const page = await this.createOrUpdatePage(userId, {
        title: entity.name,
        slug: entity.slug,
        content: entity.pageContent,
        category: entity.category,
        summary: entity.summary,
        tags: entity.tags,
        confidence: entity.confidence
      }, {
        sourceId: source.id,
        weight: entity.confidence
      })
      pageIds.push(page.id)
    }

    for (const decision of result.decisions) {
      const page = await this.createOrUpdatePage(userId, {
        title: decision.title,
        slug: decision.slug,
        content: decision.pageContent,
        category: 'decision',
        summary: decision.summary,
        tags: decision.tags,
        confidence: 0.7
      }, {
        sourceId: source.id,
        weight: 1.0
      })
      pageIds.push(page.id)
    }

    for (const ref of result.crossReferences) {
      await this.createLink(pageIds, ref)
    }

    await this.log(userId, 'ingest', {
      sessionId: session.sessionId,
      pageCount: pageIds.length,
      entityCount: result.entities.length,
      decisionCount: result.decisions.length,
      crossRefCount: result.crossReferences.length,
      isInvestigation: result.isInvestigation,
      depth: result.depth
    }, `Ingested session ${session.sessionId}: ${result.sessionSummary.title}`)

    await this.updateConfig(userId, { lastIngest: new Date() })

    await this.invalidateSearchIndex(userId)

    console.log(`[Wiki] Ingested session ${session.sessionId}: ${pageIds.length} pages created/updated`)

    return result
  }

  async createOrGetSource(userId: number, data: {
    type: string
    sessionId?: number
    title: string
    content: string
    metadata?: Record<string, any>
  }): Promise<any> {
    const sourceHash = createHash('md5')
      .update(data.content.substring(0, 10000))
      .digest('hex')

    let source: any
    if (data.type === 'session' && data.sessionId) {
      source = await prisma.wikiSource.findFirst({
        where: {
          userId,
          type: data.type,
          sessionId: data.sessionId
        }
      })
    } else {
      source = await prisma.wikiSource.findFirst({
        where: {
          userId,
          sourceHash
        }
      })
    }

    if (!source) {
      source = await prisma.wikiSource.create({
        data: {
          userId,
          type: data.type,
          sessionId: data.sessionId,
          title: data.title,
          content: data.content,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          sourceHash
        }
      })
    }

    return source
  }

  async createOrUpdatePage(
    userId: number,
    input: WikiPageInput,
    contribution?: { sourceId: number; weight: number }
  ): Promise<any> {
    const existing = await prisma.wikiPage.findUnique({
      where: { userId_slug: { userId, slug: input.slug } }
    })

    let page: any
    if (existing) {
      page = await prisma.wikiPage.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          content: input.content,
          category: input.category,
          summary: input.summary,
          frontmatter: input.tags ? JSON.stringify({ tags: input.tags }) : null,
          confidence: input.confidence,
          updateReason: 'session_ingest',
          updatedAt: new Date()
        }
      })
    } else {
      page = await prisma.wikiPage.create({
        data: {
          userId,
          title: input.title,
          slug: input.slug,
          content: input.content,
          category: input.category,
          summary: input.summary,
          frontmatter: input.tags ? JSON.stringify({ tags: input.tags }) : null,
          confidence: input.confidence,
          updateReason: 'session_ingest'
        }
      })
    }

    if (contribution) {
      await prisma.wikiPageContribution.upsert({
        where: {
          pageId_sourceId: {
            pageId: page.id,
            sourceId: contribution.sourceId
          }
        },
        update: { weight: contribution.weight },
        create: {
          pageId: page.id,
          sourceId: contribution.sourceId,
          weight: contribution.weight
        }
      })
    }

    await this.invalidateSearchIndex(userId)

    return page
  }

  async createLink(pageIds: number[], ref: CrossReference): Promise<void> {
    const fromIndex = pageIds.findIndex(id => {
      return prisma.wikiPage.findUnique({ where: { id } }).then(p => p?.slug === ref.fromSlug)
    })
    const toIndex = pageIds.findIndex(id => {
      return prisma.wikiPage.findUnique({ where: { id } }).then(p => p?.slug === ref.toSlug)
    })

    if (fromIndex === -1 || toIndex === -1) {
      return
    }

    const fromPage = await prisma.wikiPage.findUnique({ where: { id: pageIds[fromIndex] } })
    const toPage = await prisma.wikiPage.findUnique({ where: { id: pageIds[toIndex] } })

    if (!fromPage || !toPage) return

    await prisma.pageLink.upsert({
      where: {
        sourcePageId_targetPageId_linkType: {
          sourcePageId: fromPage.id,
          targetPageId: toPage.id,
          linkType: ref.type
        }
      },
      update: { context: ref.context },
      create: {
        sourcePageId: fromPage.id,
        targetPageId: toPage.id,
        linkType: ref.type,
        context: ref.context
      }
    })
  }

  async searchPages(query: WikiSearchQuery): Promise<any[]> {
    const { userId, query: searchTerm, category, limit = 20, offset = 0 } = query

    if (!searchTerm) {
      const where: { userId: number; category?: string } = { userId }
      if (category) where.category = category

      return prisma.wikiPage.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          incomingLinks: { select: { sourcePageId: true } },
          outgoingLinks: { select: { targetPageId: true } }
        }
      })
    }

    const miniSearch = await this.getSearchIndex(userId)
    const results = miniSearch.search(searchTerm, {
      fuzzy: 0.2,
      prefix: true
    })

    let pageIds = results.map(r => parseInt(r.id as string))

    if (category) {
      const categoryFiltered = results.filter(r => r.category === category)
      if (categoryFiltered.length > 0) {
        pageIds = categoryFiltered.map(r => parseInt(r.id as string))
      }
    }

    if (pageIds.length === 0) {
      return []
    }

    const pages = await prisma.wikiPage.findMany({
      where: {
        userId,
        id: { in: pageIds }
      },
      include: {
        incomingLinks: { select: { sourcePageId: true } },
        outgoingLinks: { select: { targetPageId: true } }
      }
    })

    const pageMap = new Map(pages.map(p => [p.id, p]))
    return pageIds.map(id => pageMap.get(id)).filter(Boolean)
  }

  async getPage(userId: number, slug: string): Promise<any | null> {
    const page = await prisma.wikiPage.findUnique({
      where: { userId_slug: { userId, slug } },
      include: {
        incomingLinks: {
          include: { sourcePage: { select: { slug: true, title: true, summary: true } } }
        },
        outgoingLinks: {
          include: { targetPage: { select: { slug: true, title: true, summary: true } } }
        },
        contributions: {
          include: { source: true }
        }
      }
    })

    return page
  }

  async getIndex(userId: number): Promise<Record<string, any[]>> {
    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        category: true,
        summary: true,
        updatedAt: true,
        frontmatter: true
      }
    })

    const index: Record<string, any[]> = {}
    for (const page of pages) {
      if (!index[page.category]) {
        index[page.category] = []
      }
      index[page.category].push(page)
    }

    return index
  }

  async getGraph(userId: number): Promise<{ nodes: any[]; edges: any[] }> {
    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      select: { id: true, slug: true, title: true, category: true }
    })

    const links = await prisma.pageLink.findMany({
      where: {
        OR: [
          { sourcePage: { userId } },
          { targetPage: { userId } }
        ]
      },
      include: {
        sourcePage: { select: { slug: true } },
        targetPage: { select: { slug: true } }
      }
    })

    return {
      nodes: pages.map(p => ({ id: p.slug, title: p.title, category: p.category })),
      edges: links.map(l => ({
        source: l.sourcePage.slug,
        target: l.targetPage.slug,
        type: l.linkType
      }))
    }
  }

  async getStats(userId: number): Promise<{
    totalPages: number
    byCategory: Record<string, number>
    bySource: Record<string, number>
    lastIngest: Date | null
  }> {
    const config = await this.getOrCreateConfig(userId)

    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      select: { category: true }
    })

    const contributions = await prisma.wikiPageContribution.findMany({
      where: { page: { userId } },
      include: { source: { select: { type: true } } }
    })

    const byCategory: Record<string, number> = {}
    const bySource: Record<string, number> = {}

    for (const page of pages) {
      byCategory[page.category] = (byCategory[page.category] || 0) + 1
    }

    for (const contrib of contributions) {
      bySource[contrib.source.type] = (bySource[contrib.source.type] || 0) + 1
    }

    return {
      totalPages: pages.length,
      byCategory,
      bySource,
      lastIngest: config?.lastIngest || null
    }
  }

  async log(userId: number, action: string, actionData: any, description: string): Promise<void> {
    await prisma.wikiLog.create({
      data: {
        userId,
        action,
        actionData: JSON.stringify(actionData),
        description
      }
    })
  }

  async getLog(userId: number, limit = 50): Promise<any[]> {
    return prisma.wikiLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  async lint(userId: number): Promise<{ orphans: any[]; stale: any[]; suggestions: string[] }> {
    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      include: {
        incomingLinks: true,
        outgoingLinks: true
      }
    })

    const orphans = pages.filter(p => p.incomingLinks.length === 0 && p.outgoingLinks.length === 0 && p.category !== 'summary')

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const stale = pages.filter(p => p.updatedAt < oneWeekAgo && p.category === 'investigation')

    const suggestions: string[] = []

    const categories = pages.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    if (categories.entity && categories.entity > 20) {
      suggestions.push('Consider creating concept pages to group related entities')
    }

    if (orphans.length > 0) {
      suggestions.push(`${orphans.length} orphan pages need cross-references`)
    }

    await this.log(userId, 'lint', { orphans: orphans.length, stale: stale.length, suggestions }, `Lint complete: ${suggestions.length} suggestions`)
    await this.updateConfig(userId, { lastLint: new Date() })

    return { orphans, stale, suggestions }
  }
}

export const wikiService = new WikiService()