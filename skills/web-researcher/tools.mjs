export const webSearchTool = {
  name: 'web_search',
  description: 'Search the web for information. Returns detailed content, not just links. Use for factual queries, finding information, and data analysis.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      numResults: { type: 'number', description: 'Number of results to return', default: 3 }
    },
    required: ['query']
  },
  
  async execute({ query, numResults = 3 }, config) {
    const apiKey = config?.apiKey
    const engine = config?.engine || 'tavily'
    
    if (!apiKey) {
      return JSON.stringify({
        error: 'API key not configured. Please configure the web-researcher skill in Settings.',
        markdown: '**Web Search Error**\n\nAPI key not configured. Please configure the web-researcher skill in Settings.',
        data: null
      })
    }
    
    const extractPageContent = async (url) => {
      try {
        const response = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, urls: [url] })
        })
        if (response.ok) {
          const data = await response.json()
          return data.results?.[0]?.content || null
        }
      } catch (e) {
        console.log('Extract failed:', e.message)
      }
      return null
    }
    
    try {
      if (engine === 'tavily') {
        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, query, max_results: numResults })
        })
        
        if (!searchResponse.ok) {
          throw new Error(`Tavily API error: ${searchResponse.status}`)
        }
        
        const searchData = await searchResponse.json()
        const results = searchData.results || []
        
        if (results.length === 0) {
          return JSON.stringify({
            query,
            results: [],
            markdown: `**Search Results for "${query}"**\n\nNo results found.`,
            data: []
          })
        }
        
        const detailedResults = []
        
        for (const result of results.slice(0, numResults)) {
          const url = result.url
          const content = await extractPageContent(url)
          
          detailedResults.push({
            title: result.title || 'Untitled',
            url: url,
            snippet: result.content || result.snippet || '',
            content: content || result.content || result.snippet || ''
          })
        }
        
        let markdown = `**Search Results for "${query}"**\n\n`
        
        detailedResults.forEach((r, i) => {
          markdown += `### ${i + 1}. ${r.title}\n`
          markdown += `**Source:** [${r.url}](${r.url})\n\n`
          markdown += `**Content:**\n${r.content.substring(0, 1500)}${r.content.length > 1500 ? '\n...(truncated)' : ''}\n\n`
          markdown += `---\n\n`
        })
        
        return JSON.stringify({
          query,
          resultsCount: detailedResults.length,
          markdown,
          data: detailedResults
        })
      }
      
      return JSON.stringify({
        error: `Unknown engine: ${engine}`,
        markdown: `**Web Search Error**\n\nUnknown engine: ${engine}`,
        data: null
      })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Search failed'
      return JSON.stringify({
        error: errMsg,
        markdown: `**Web Search Error**\n\n${errMsg}`,
        data: null
      })
    }
  }
}

export default [webSearchTool]