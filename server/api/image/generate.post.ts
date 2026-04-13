import http from 'node:http'
import https from 'node:https'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'

type Protocol = 'http:' | 'https:'

const proxyAgentCache = new Map<string, InstanceType<typeof HttpProxyAgent> | InstanceType<typeof HttpsProxyAgent> | InstanceType<typeof SocksProxyAgent>>()

function getProxyAgent(proxyUrl: string, protocol: Protocol) {
  if (proxyAgentCache.has(proxyUrl))
    return proxyAgentCache.get(proxyUrl)!

  proxyAgentCache.clear()

  const agent = proxyUrl.startsWith('http:')
    ? protocol === 'https:' ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl)
    : new SocksProxyAgent(proxyUrl)

  proxyAgentCache.set(proxyUrl, agent)
  return agent
}

interface MiniMaxKeys {
    key: string
    endpoint?: string
    secondary?: {
        key: string
        endpoint?: string
    }
}

function isUsageLimitError(error: any): boolean {
    const errorMsg = typeof error === 'string' ? error : error?.message || ''
    const statusCode = error?.base_resp?.status_code || error?.status_code
    
    // Usage limit errors
    const isUsageLimit = statusCode === 2063 || statusCode === 2056 || statusCode === 1008 ||
        errorMsg.includes('token plan only supports') || 
        errorMsg.includes('usage limit exceeded') || 
        errorMsg.includes('insufficient balance')
    
    // Plan/feature not supported errors
    const isPlanError = statusCode === 1919 ||
        errorMsg.includes('plan') ||
        errorMsg.includes('not support') ||
        errorMsg.includes('not enabled') ||
        errorMsg.includes('feature not available') ||
        errorMsg.includes('does not include')
    
    return isUsageLimit || isPlanError
}

async function withMiniMaxFallback<T>(
    keys: MiniMaxKeys,
    primaryOnlyFn: (key: string, endpoint: string) => Promise<T>,
    fallbackFn: (key: string, endpoint: string) => Promise<T>
): Promise<T> {
    const primaryEndpoint = keys.endpoint || 'https://api.minimax.io'
    
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

// MiniMax Image Models
export const MINIMAX_IMAGE_MODELS = [
    { id: 'image-01', name: 'Image 01', description: 'Latest high quality model' },
    { id: 'image-01-live', name: 'Image 01 Live', description: 'Real-time image generation' },
]

// Gemini Imagen Models
export const GEMINI_IMAGE_MODELS = [
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4', description: 'Flagship model, best quality ($0.04/image)' },
    { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra', description: 'Best quality for complex prompts ($0.06/image)' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3', description: 'Previous generation ($0.03/image)' },
]

async function generateMiniMaxImage(prompt: string, apiKey: string, options: {
    aspect_ratio?: string
    n?: number
    model?: string
}, endpoint?: string) {
    const apiEndpoint = endpoint?.replace('/v1', '') || 'https://api.minimax.io'
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

async function generateGeminiImage(prompt: string, apiKey: string, options: {
    aspect_ratio?: string
    n?: number
    model?: string
}, proxyUrl?: string) {
    const model = options.model || 'imagen-3.0-generate-002'
    const numberOfImages = options.n || 1
    
    // Map aspect ratio to Gemini format
    const aspectRatioMap: Record<string, string> = {
        '1:1': '1:1',
        '16:9': '16:9',
        '4:3': '4:3',
        '3:2': '3:2',
        '2:3': '2:3',
        '3:4': '3:4',
        '9:16': '9:16',
        '21:9': '16:9'
    }
    const aspectRatio = aspectRatioMap[options.aspect_ratio || '1:1'] || '1:1'

    // Correct Gemini Imagen API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
    const requestBody = JSON.stringify({
        instances: [{ prompt }],
        parameters: { numberOfImages, aspectRatio }
    })

    let response: Response

    if (proxyUrl) {
        response = await new Promise((resolve, reject) => {
            const request = https.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                },
                agent: getProxyAgent(proxyUrl, 'https:')
            }, (res) => {
                const chunks: Buffer[] = []
                res.on('data', chunk => chunks.push(chunk))
                res.on('end', () => {
                    resolve(new Response(Buffer.concat(chunks), {
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers as Record<string, string>
                    }))
                })
                res.on('error', reject)
            })
            request.on('error', reject)
            request.write(requestBody)
            request.end()
        })
    } else {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
        })
    }

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini Imagen error: ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    console.log('[Gemini Image] Raw response keys:', Object.keys(data))
    console.log('[Gemini Image] Raw response:', JSON.stringify(data).substring(0, 1000))
    
    if (!data.predictions || data.predictions.length === 0) {
        throw new Error('No image generated, response: ' + JSON.stringify(data).substring(0, 200))
    }

    const imageUrls = data.predictions.map((p: any) => {
        const base64 = p.bytesBase64Encoded || p.base64 || p.bytes || p.b64Image || p.base64EncodedBytes || null
        return base64 ? `data:${p.mimeType || 'image/png'};base64,${base64}` : null
    })
    console.log('[Gemini Image] Processed image URLs (first):', imageUrls[0]?.substring(0, 100))

    return {
        imageUrls,
        model
    }
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { 
        prompt, 
        aspect_ratio, 
        n = 1, 
        model,
        provider = 'minimax'
    } = body

    if (!prompt) {
        throw createError({
            statusCode: 400,
            message: 'Prompt is required'
        })
    }

    const keys = event.context.keys

    if (provider === 'gemini') {
        const geminiKey = keys.gemini?.key
        if (!geminiKey) {
            throw createError({
                statusCode: 401,
                message: 'Gemini API key not configured'
            })
        }

        const config = useRuntimeConfig()
        const proxyUrl = config.modelProxyUrl

        try {
            const result = await generateGeminiImage(prompt, geminiKey, { aspect_ratio, n, model }, proxyUrl)
            
            return JSON.stringify({
                imageUrls: result.imageUrls,
                model: result.model,
                provider: 'gemini'
            })
        } catch (error: any) {
            console.error('[Gemini Image] Error:', error.message)
            throw createError({
                statusCode: 500,
                message: error.message || 'Gemini image generation failed'
            })
        }
    }

    // MiniMax (default)
    const minimaxKeys = keys?.minimax

    if (!minimaxKeys?.key) {
        throw createError({
            statusCode: 401,
            message: 'MiniMax API key not configured'
        })
    }

    try {
        const result = await withMiniMaxFallback(
            minimaxKeys,
            async (apiKey, endpoint) => {
                return await generateMiniMaxImage(prompt, apiKey, { aspect_ratio, n, model }, endpoint)
            },
            async (apiKey, endpoint) => {
                return await generateMiniMaxImage(prompt, apiKey, { aspect_ratio, n, model }, endpoint)
            }
        )

        return JSON.stringify({
            imageUrls: result.data?.image_urls || [],
            taskId: result.id,
            successCount: result.metadata?.success_count || 0,
            failedCount: result.metadata?.failed_count || 0,
            provider: 'minimax'
        })
    } catch (error: any) {
        console.error('[ImageTool] Error:', error.message)
        throw createError({
            statusCode: 500,
            message: error.message || 'Image generation failed'
        })
    }
})
