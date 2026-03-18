import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const svgSchema = z.object({
    svg: z.string().describe('The SVG code to render'),
    title: z.string().optional().describe('Optional title for the SVG'),
})

export const svgTool = tool(
    async (input: { svg: string; title?: string }) => {
        console.log('[SvgTool] Rendering SVG', { title: input.title, svgLength: input.svg.length })

        return JSON.stringify({
            svg: input.svg,
            title: input.title || ''
        })
    },
    {
        name: 'render_svg',
        description: `Render an SVG (Scalable Vector Graphics) image in the chat. Use this tool when you need to:
- Display charts, graphs, or visualizations
- Show diagrams or illustrations
- Render any SVG-based graphics

The SVG code will be rendered as an image in the chat interface.`,
        schema: svgSchema,
    }
)

export const svgTools = [svgTool]
