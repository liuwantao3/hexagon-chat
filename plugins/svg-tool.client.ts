import { useTools } from '~/composables/useTools'

export default defineNuxtPlugin(() => {
  const { registerTool } = useTools()

  registerTool({
    type: 'function',
    name: 'display_svg',
    description: 'Render an SVG graph in the chat. Use this when you generate SVG code for visualization.',
    parameters: {
      type: 'object',
      properties: {
        svg_code: { type: 'string', description: 'The SVG code to render' }
      }
    },
    handler: async ({ svg_code }: { svg_code: string }) => {
      return { svg: svg_code }
    }
  })
})
