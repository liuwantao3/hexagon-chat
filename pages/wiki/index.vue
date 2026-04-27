<script setup lang="ts">
import * as d3 from 'd3'

const { t } = useI18n()
const { data: auth } = useAuth()

interface WikiPage {
  id: number
  title: string
  slug: string
  content: string
  category: string
  summary: string | null
  confidence: number
  updatedAt: string
  frontmatter: string | null
  incomingLinks: any[]
  outgoingLinks: any[]
}

interface WikiConfig {
  enabled: boolean
  autoIngest: boolean
  ingestHours: number
  lastIngest: string | null
  lastLint: string | null
}

interface WikiStats {
  totalPages: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
  lastIngest: string | null
}

interface GraphNode {
  id: string
  title: string
  category: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

const pages = ref<WikiPage[]>([])
const config = ref<WikiConfig | null>(null)
const stats = ref<WikiStats | null>(null)
const loading = ref(true)
const selectedCategory = ref<string | null>(null)
const selectedPage = ref<WikiPage | null>(null)
const searchQuery = ref('')
const viewMode = ref<'list' | 'graph'>('list')
const graphContainer = ref<HTMLElement | null>(null)

const userId = computed(() => auth.value?.id)

const categories = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.byCategory).map(([name, count]) => ({ name, count }))
})

const filteredPages = computed(() => {
  let result = pages.value
  
  if (selectedCategory.value) {
    result = result.filter(p => p.category === selectedCategory.value)
  }
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.content.toLowerCase().includes(query) ||
      (p.summary && p.summary.toLowerCase().includes(query))
    )
  }
  
  return result
})

async function loadWiki() {
  loading.value = true
  try {
    const result = await $fetchWithAuth('/api/wiki') as any

    if (result.success) {
      config.value = result.config
      stats.value = result.stats
    }

    const pagesResult = await $fetchWithAuth('/api/wiki/pages', {
      query: { limit: 100 }
    }) as any

    if (pagesResult.success) {
      pages.value = pagesResult.pages
    }
  } catch (e) {
    console.error('Failed to load wiki:', e)
  } finally {
    loading.value = false
  }
}

async function selectCategory(category: string | null) {
  selectedCategory.value = category
}

async function selectPage(page: WikiPage) {
  const result = await $fetchWithAuth(`/api/wiki/page/${page.slug}`) as any

  if (result.success) {
    selectedPage.value = result.page
  } else {
    selectedPage.value = page
  }
}

function closeDetail() {
  selectedPage.value = null
}

function navigateToLink(slug: string | undefined) {
  if (!slug) return
  const page = pages.value.find(p => p.slug === slug)
  if (page) {
    selectPage(page)
  } else {
    $fetchWithAuth(`/api/wiki/page/${slug}`).then((result: any) => {
      if (result.success) {
        selectedPage.value = result.page
      }
    }).catch(console.error)
  }
}

function renderPageContent(content: string): string {
  if (!content) return ''

  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wiki-internal-link">$1</span>')

  return html
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    entity: '#3b82f6',
    concept: '#22c55e',
    topic: '#f97316',
    summary: '#8b5cf6',
    decision: '#ec4899',
    comparison: '#14b8a6',
    investigation: '#f59e0b',
    source: '#6b7280'
  }
  return colors[category] || colors.source
}

function initGraph() {
  console.log('[Wiki Graph] initGraph called', { hasContainer: !!graphContainer.value, pageCount: filteredPages.value.length })
  if (!graphContainer.value || filteredPages.value.length === 0) {
    console.log('[Wiki Graph] Early return - no container or no pages')
    return
  }
  
  const container = graphContainer.value
  container.innerHTML = ''
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  const nodes: GraphNode[] = filteredPages.value.map(p => ({
    id: p.slug,
    title: p.title,
    category: p.category
  }))
  
  const pageIdToSlug = new Map(filteredPages.value.map(p => [p.id, p.slug]))
  
  const links: GraphLink[] = []
  filteredPages.value.forEach(p => {
    p.outgoingLinks?.forEach((link: any) => {
      const targetSlug = link.targetPage?.slug || pageIdToSlug.get(link.targetPageId)
      if (targetSlug) {
        links.push({
          source: p.slug,
          target: targetSlug,
          type: link.linkType
        })
      }
    })
  })
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  const g = svg.append('g')

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
    })

  svg.call(zoom)

  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#9ca3af')

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40))

  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#9ca3af')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)')

  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag<SVGGElement, GraphNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (_, d) => {
      const page = filteredPages.value.find(p => p.slug === d.id)
      if (page) selectPage(page)
    })

  node.append('circle')
    .attr('r', 16)
    .attr('fill', d => getCategoryColor(d.category))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)

  node.append('text')
    .text(d => d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title)
    .attr('x', 20)
    .attr('y', 4)
    .attr('font-size', '12px')
    .attr('fill', 'currentColor')

  simulation.on('tick', () => {
    link
      .attr('x1', d => (d.source as GraphNode).x || 0)
      .attr('y1', d => (d.source as GraphNode).y || 0)
      .attr('x2', d => (d.target as GraphNode).x || 0)
      .attr('y2', d => (d.target as GraphNode).y || 0)

    node.attr('transform', d => `translate(${d.x},${d.y})`)
  })
  
  function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }
  
  function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }
  
  function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
    if (!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }
}

watch(viewMode, (newMode) => {
  console.log('[Wiki Graph] viewMode changed to:', newMode)
  if (newMode === 'graph') {
    nextTick(() => {
      console.log('[Wiki Graph] nextTick callback, calling initGraph')
      initGraph()
    })
  }
})

watch(filteredPages, () => {
  if (viewMode.value === 'graph') {
    nextTick(() => initGraph())
  }
}, { deep: true })

onMounted(() => {
  if (!auth.value?.id) {
    navigateTo('/login')
    return
  }
  loadWiki()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold">LLM Wiki</h1>
          <UBadge v-if="config?.autoIngest" color="green" variant="soft" size="sm">
            Auto-ingest ON
          </UBadge>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">{{ stats?.totalPages || 0 }} pages</span>
          <div class="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button 
              class="px-3 py-1 text-sm transition-colors"
              :class="viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'"
              @click="viewMode = 'list'"
            >
              <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
            </button>
            <button 
              class="px-3 py-1 text-sm transition-colors"
              :class="viewMode === 'graph' ? 'bg-primary-500 text-white' : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'"
              @click="viewMode = 'graph'"
            >
              <UIcon name="i-heroicons-circle-stack" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-3">
        <UInput
          v-model="searchQuery"
          placeholder="Search wiki..."
          icon="i-heroicons-magnifying-glass"
          class="sm:w-64"
          clearable
        />
        
        <div class="flex flex-wrap gap-2">
          <UBadge 
            :color="!selectedCategory ? 'primary' : 'gray'" 
            variant="soft"
            class="cursor-pointer"
            @click="selectCategory(null)"
          >
            All ({{ stats?.totalPages || 0 }})
          </UBadge>
          <UBadge 
            v-for="cat in categories" 
            :key="cat.name"
            :color="selectedCategory === cat.name ? 'primary' : 'gray'"
            variant="soft"
            class="cursor-pointer"
            @click="selectCategory(cat.name)"
          >
            {{ cat.name }} ({{ cat.count }})
          </UBadge>
        </div>
      </div>
      
      <div v-if="config?.lastIngest" class="mt-3 text-xs text-gray-500">
        Last ingest: {{ new Date(config.lastIngest).toLocaleString() }}
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <div class="flex-1 p-4 overflow-auto">
        <div v-if="loading" class="flex items-center justify-center h-full">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl" />
        </div>
        
        <div v-else-if="filteredPages.length === 0" class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <p>No wiki pages yet.</p>
            <p class="text-sm mt-2">Your conversations will be automatically ingested into the wiki.</p>
          </div>
        </div>
        
        <template v-else>
          <div v-if="viewMode === 'list'" class="space-y-4">
            <div 
              v-for="page in filteredPages" 
              :key="page.id"
              class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 cursor-pointer transition-colors"
              @click="selectPage(page)"
            >
              <div class="flex items-center gap-2 mb-2">
                <UBadge :color="page.category === 'entity' ? 'blue' : page.category === 'concept' ? 'green' : page.category === 'decision' ? 'pink' : 'gray'" size="sm">
                  {{ page.category }}
                </UBadge>
                <span v-if="page.confidence > 0.7" class="text-xs text-green-600">✓ Verified</span>
              </div>
              <h3 class="font-semibold mb-1">{{ page.title }}</h3>
              <p v-if="page.summary" class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ page.summary }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>{{ page.outgoingLinks?.length || 0 }} outgoing links</span>
                <span>{{ page.incomingLinks?.length || 0 }} incoming links</span>
                <span>{{ new Date(page.updatedAt).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
          
          <div v-else ref="graphContainer" class="w-full min-h-[500px] bg-gray-50 dark:bg-gray-900 rounded-lg" />
        </template>
      </div>
    </div>

    <Transition name="slide">
      <div 
        v-if="selectedPage" 
        class="fixed inset-y-0 right-0 w-[600px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-auto z-50"
      >
        <div class="p-6">
          <div class="flex items-start justify-between mb-6">
            <div>
              <UBadge :color="selectedPage.category === 'entity' ? 'blue' : selectedPage.category === 'concept' ? 'green' : selectedPage.category === 'decision' ? 'pink' : 'gray'" class="mb-2">
                {{ selectedPage.category }}
              </UBadge>
              <h2 class="text-2xl font-bold">{{ selectedPage.title }}</h2>
            </div>
            <UButton icon="i-heroicons-x-mark" variant="ghost" @click="closeDetail" />
          </div>
          
          <div class="mb-4 flex items-center gap-4 text-sm text-gray-500">
            <span>Confidence: {{ Math.round(selectedPage.confidence * 100) }}%</span>
            <span>Updated: {{ new Date(selectedPage.updatedAt).toLocaleDateString() }}</span>
          </div>
          
          <div class="prose dark:prose-invert max-w-none">
            <div class="whitespace-pre-wrap text-sm" v-html="renderPageContent(selectedPage.content)"></div>
          </div>
          
          <div v-if="selectedPage.outgoingLinks?.length > 0" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 class="font-semibold mb-3">Links from this page</h4>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="link in selectedPage.outgoingLinks"
                :key="link.id"
                variant="soft"
                size="sm"
                @click="navigateToLink(link.targetPage?.slug)"
              >
                → {{ link.targetPage?.title || link.targetPage?.slug || 'Unknown' }}
              </UButton>
            </div>
          </div>
          
          <div v-if="selectedPage.incomingLinks?.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 class="font-semibold mb-3">Links to this page</h4>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="link in selectedPage.incomingLinks"
                :key="link.id"
                variant="soft"
                size="sm"
                @click="navigateToLink(link.sourcePage?.slug)"
              >
                ← {{ link.sourcePage?.title || link.sourcePage?.slug || 'Unknown' }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>