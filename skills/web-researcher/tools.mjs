export const webSearchTool = {
  name: 'web_search',
  description: 'Search the web for information. Use this when you need current facts, statistics, or news.',
  
  async execute({ query, numResults = 5 }) {
    // Placeholder - replace with actual search API (e.g., Tavily, SerpAPI, etc.)
    return JSON.stringify({
      query,
      results: [
        { title: 'Example Result 1', url: 'https://example.com/1', snippet: 'This is a placeholder search result.' },
        { title: 'Example Result 2', url: 'https://example.com/2', snippet: 'Another placeholder result.' },
      ],
      note: 'Configure your search API in skills/web-researcher/tools.mjs'
    })
  }
}

export default [webSearchTool]
