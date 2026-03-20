import { tool } from '@langchain/core/tools'
import { z } from 'zod'

let currentApiKey: string | undefined = undefined
let currentEndpoint: string | undefined = undefined
let secondaryApiKey: string | undefined = undefined
let secondaryEndpoint: string | undefined = undefined

export function setImageToolKeys(apiKey?: string, endpoint?: string, secondary?: { key?: string; endpoint?: string }) {
    currentApiKey = apiKey
    currentEndpoint = endpoint
    secondaryApiKey = secondary?.key
    secondaryEndpoint = secondary?.endpoint
}

function isUsageLimitError(error: any): boolean {
    return error?.base_resp?.status_code === 2063 || 
           error?.base_resp?.status_code === 2056 ||
           error?.base_resp?.status_code === 1008 ||
           error?.status_code === 2063 ||
           error?.status_code === 2056 ||
           error?.status_code === 1008 ||
           (typeof error === 'string' && (error.includes('token plan only supports') || error.includes('usage limit exceeded') || error.includes('insufficient balance')))
}

const imageSchema = z.object({
    prompt: z.string().describe('The text description of the image to generate, max 1500 characters'),
    aspect_ratio: z.enum(['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9']).optional().describe('Image aspect ratio'),
    n: z.number().min(1).max(9).optional().describe('Number of images to generate (1-9)'),
    model: z.enum(['image-01', 'image-01-live']).optional().describe('Model to use'),
})

async function generateImage(prompt: string, apiKey: string, options: {
    aspect_ratio?: string
    n?: number
    model?: string
}, endpoint?: string) {
    const apiEndpoint = endpoint || 'https://api.minimaxi.com'
    const response = await fetch(`${apiEndpoint}/v1/image_generation`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: options.model || 'image-01',
            prompt,
            aspect_ratio: options.aspect_ratio || '1:1',
            response_format: 'url',
            n: options.n || 1,
            prompt_optimizer: false,
            aigc_watermark: false
        })
    })

    const data = await response.json()

    if (data.base_resp?.status_code !== 0) {
        throw new Error(data.base_resp?.status_msg || 'Image generation failed')
    }

    return data
}

export const imageTool = tool(
    async (input: { prompt: string; aspect_ratio?: string; n?: number; model?: string }) => {
        console.log('[ImageTool] Generating image', { promptLength: input.prompt.length, n: input.n })

        const apiKey = currentApiKey || process.env.MINIMAX_API_KEY
        
        if (!apiKey) {
            return JSON.stringify({
                error: 'MiniMax API key not configured. Please add your MiniMax API key in settings.',
                imageUrls: []
            })
        }

        const primaryEndpoint = currentEndpoint || 'https://api.minimaxi.com'

        try {
            const result = await generateImage(input.prompt, apiKey, {
                aspect_ratio: input.aspect_ratio,
                n: input.n,
                model: input.model
            }, primaryEndpoint)

            console.log('[ImageTool] Generated', result.data?.image_urls?.length || 0, 'images')

            return JSON.stringify({
                imageUrls: result.data?.image_urls || [],
                taskId: result.id,
                successCount: result.metadata?.success_count || 0,
                failedCount: result.metadata?.failed_count || 0
            })
        } catch (error: any) {
            console.error('[ImageTool] Primary API error:', error.message)

            if (secondaryApiKey && isUsageLimitError(error)) {
                console.log('[ImageTool] Primary API usage limit reached, switching to secondary API')
                const secondaryEp = secondaryEndpoint || primaryEndpoint
                try {
                    const result = await generateImage(input.prompt, secondaryApiKey, {
                        aspect_ratio: input.aspect_ratio,
                        n: input.n,
                        model: input.model
                    }, secondaryEp)

                    console.log('[ImageTool] Secondary API generated', result.data?.image_urls?.length || 0, 'images')

                    return JSON.stringify({
                        imageUrls: result.data?.image_urls || [],
                        taskId: result.id,
                        successCount: result.metadata?.success_count || 0,
                        failedCount: result.metadata?.failed_count || 0
                    })
                } catch (secondaryError: any) {
                    console.error('[ImageTool] Secondary API error:', secondaryError.message)
                    return JSON.stringify({
                        error: secondaryError.message || 'Image generation failed',
                        imageUrls: []
                    })
                }
            }

            return JSON.stringify({
                error: error.message || 'Image generation failed',
                imageUrls: []
            })
        }
    },
    {
        name: 'generate_image',
        description: `Generate images from text prompts using AI. Use this tool when you need to:
- Create illustrations or artwork from descriptions
- Generate photos or realistic images
- Create logos or icons
- Generate any visual content from text

The tool supports various aspect ratios (1:1, 16:9, 4:3, etc.) and can generate multiple images at once.`,
        schema: imageSchema,
    }
)

export const imageTools = [imageTool]
