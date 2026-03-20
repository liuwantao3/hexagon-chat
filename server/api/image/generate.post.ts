import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const imageSchema = z.object({
    prompt: z.string().describe('The text description of the image to generate, max 1500 characters'),
    aspect_ratio: z.enum(['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9']).optional().describe('Image aspect ratio'),
    n: z.number().min(1).max(9).optional().describe('Number of images to generate (1-9)'),
    model: z.enum(['image-01', 'image-01-live']).optional().describe('Model to use'),
})

interface MiniMaxKeys {
    key: string
    endpoint?: string
    secondary?: {
        key: string
        endpoint?: string
    }
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

async function withMiniMaxFallback<T>(
    keys: MiniMaxKeys,
    primaryOnlyFn: (key: string, endpoint: string) => Promise<T>,
    fallbackFn: (key: string, endpoint: string) => Promise<T>
): Promise<T> {
    const primaryEndpoint = keys.endpoint || 'https://api.minimaxi.com'
    
    try {
        return await primaryOnlyFn(keys.key, primaryEndpoint)
    } catch (error: any) {
        if (!keys.secondary?.key || !isUsageLimitError(error)) {
            throw error
        }
        
        const secondaryEndpoint = keys.secondary.endpoint || primaryEndpoint
        console.log('Primary API usage limit reached, switching to secondary API')
        return fallbackFn(keys.secondary.key, secondaryEndpoint)
    }
}

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
    const minimaxKeys = keys?.minimax

    if (!minimaxKeys?.key) {
        throw createError({
            statusCode: 401,
            statusMessage: 'MiniMax API key not configured'
        })
    }

    try {
        const result = await withMiniMaxFallback(
            minimaxKeys,
            async (apiKey, endpoint) => {
                return await generateImage(prompt, apiKey, { aspect_ratio, n, model }, endpoint)
            },
            async (apiKey, endpoint) => {
                return await generateImage(prompt, apiKey, { aspect_ratio, n, model }, endpoint)
            }
        )

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
