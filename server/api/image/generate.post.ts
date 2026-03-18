import { tool } from '@langchain/core/tools'
import { z } from 'zod'

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

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { prompt, aspect_ratio, n, model } = body

    if (!prompt) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Prompt is required'
        })
    }

    const keys = event.context.keys
    const apiKey = keys?.minimax?.key

    if (!apiKey) {
        throw createError({
            statusCode: 401,
            statusMessage: 'MiniMax API key not configured'
        })
    }

    try {
        const result = await generateImage(prompt, apiKey, {
            aspect_ratio,
            n,
            model
        }, keys?.minimax?.endpoint)

        return JSON.stringify({
            imageUrls: result.data?.image_urls || [],
            taskId: result.id,
            successCount: result.metadata?.success_count || 0,
            failedCount: result.metadata?.failed_count || 0
        })
    } catch (error: any) {
        console.error('[ImageTool] Error:', error.message)
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Image generation failed'
        })
    }
})
