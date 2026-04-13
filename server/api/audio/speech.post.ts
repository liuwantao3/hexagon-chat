import http from 'node:http'
import https from 'node:https'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'

function createWavHeader(audioData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const dataSize = audioData.length
  const fileSize = 36 + dataSize
  
  const header = Buffer.alloc(44)
  
  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  
  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // chunk size
  header.writeUInt16LE(1, 20) // PCM format
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28) // byte rate
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32) // block align
  header.writeUInt16LE(bitsPerSample, 34)
  
  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  
  // Copy audio data after header
  return Buffer.concat([header, audioData])
}

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
  const errorMsg = typeof error === 'string' ? error : error?.message || String(error || '')
  const statusCode = error?.base_resp?.status_code || error?.statusCode || error?.status_code
  
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

// MiniMax TTS Models
export const MINIMAX_TTS_MODELS = [
  { id: 'speech-2.8-hd', name: 'Speech 2.8 HD', description: 'Latest HD model, best quality' },
  { id: 'speech-2.8-turbo', name: 'Speech 2.8 Turbo', description: 'Latest Turbo model, fast' },
  { id: 'speech-2.6-hd', name: 'Speech 2.6 HD', description: 'HD model with outstanding prosody' },
  { id: 'speech-2.6-turbo', name: 'Speech 2.6 Turbo', description: 'Turbo model, 40 languages' },
]

// Gemini TTS Models
export const GEMINI_TTS_MODELS = [
  { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash TTS', description: 'Low latency, single/multi-speaker' },
  { id: 'gemini-2.5-pro-preview-tts', name: 'Gemini 2.5 Pro TTS', description: 'High quality, long-form content' },
]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { 
    text, 
    provider = 'minimax',
    voice_id,
    model,
    speed = 1,
    emotion = 'happy',
    format = 'mp3',
    stream = false,
    // Gemini specific
    voice_name,
    response_modality = 'audio'
  } = body

  const keys = event.context.keys

  if (provider === 'gemini') {
    // Gemini TTS
    const geminiKey = keys.gemini?.key
    if (!geminiKey) {
      throw createError({ 
        statusCode: 401, 
        message: 'Gemini API key required for Gemini TTS' 
      })
    }

    const config = useRuntimeConfig()
    const proxyUrl = config.modelProxyUrl
    const selectedModel = model || 'gemini-2.5-flash-preview-tts'
    console.log('[Gemini TTS] Using model:', selectedModel, 'Proxy:', proxyUrl || 'none')

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiKey}`
      const requestBody = JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: [response_modality]
        },
        ...(voice_name && {
          voiceConfig: {
            prebuiltVoiceConfig: {
              speakerName: voice_name
            }
          }
        })
      })

      let response: Response

      if (proxyUrl) {
        // Use proxy
        response = await new Promise((resolve, reject) => {
          const uri = new URL(url)
          const client = uri.protocol === 'https:' ? https : http
          
          const request = client.request(url, {
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
              const body = Buffer.concat(chunks)
              const headers: Record<string, string | string[]> = {}
              Object.entries(res.headers).forEach(([key, value]) => {
                if (value) headers[key] = value
              })
              resolve(new Response(body, {
                status: res.statusCode,
                statusText: res.statusMessage,
                headers
              }))
            })
            res.on('error', reject)
          })
          request.on('error', reject)
          request.write(requestBody)
          request.end()
        })
      } else {
        // Direct fetch
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Gemini TTS] Error:', response.status, errorText)
        throw createError({
          statusCode: response.status,
          message: `Gemini TTS error: ${errorText.substring(0, 200)}`
        })
      }

      const contentType = response.headers.get('content-type') || ''
      let audioContentType = 'audio/mpeg' // default to mp3 compatible
      
      if (contentType.includes('audio')) {
        // Audio response - return directly
        const audioBuffer = Buffer.from(await response.arrayBuffer())
        
        // Detect format from content-type
        if (contentType.includes('mp4')) audioContentType = 'audio/mp4'
        else if (contentType.includes('wav')) audioContentType = 'audio/wav'
        else if (contentType.includes('webm')) audioContentType = 'audio/webm'
        else if (contentType.includes('mpeg') || contentType.includes('mp3')) audioContentType = 'audio/mpeg'
        
        console.log('[Gemini TTS] Returning audio, type:', audioContentType, 'size:', audioBuffer.length)
        setHeader(event, 'Content-Type', audioContentType)
        setHeader(event, 'Content-Length', audioBuffer.length)
        event.node.res.end(audioBuffer)
        return
      } else {
        // JSON response - might contain audio data
        const data = await response.json()
        
        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
        
        if (inlineData?.data) {
          const audioData = inlineData.data
          const audioBuffer = Buffer.from(audioData, 'base64')
          const mimeType = inlineData.mimeType || ''
          
          console.log('[Gemini TTS] Audio mimeType:', mimeType, 'size:', audioBuffer.length)
          
          // Check if it's PCM - need to wrap in WAV
          if (mimeType.includes('L16') || mimeType.includes('pcm')) {
            // Extract rate from mimeType (default to 24000)
            console.log('[Gemini TTS] Full mimeType:', mimeType)
            const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000')
            const numChannels = mimeType.includes('mono') ? 1 : (mimeType.includes('stereo') ? 2 : 1)
            const bitsPerSample = 16
            
            // Create WAV header
            const wavBuffer = createWavHeader(audioBuffer, sampleRate, numChannels, bitsPerSample)
            console.log('[Gemini TTS] Wrapped PCM in WAV, sampleRate:', sampleRate, 'channels:', numChannels, 'total size:', wavBuffer.length)
            // Log first few bytes to verify WAV header
            console.log('[Gemini TTS] WAV header:', Buffer.from(wavBuffer.slice(0, 44).toString('ascii')).toString())
            
            setHeader(event, 'Content-Type', 'audio/wav')
            setHeader(event, 'Content-Length', wavBuffer.length)
            event.node.res.end(wavBuffer)
            return
          }
          
          // For other formats
          console.log('[Gemini TTS] Returning audio, size:', audioBuffer.length)
          setHeader(event, 'Content-Type', 'audio/wav')
          setHeader(event, 'Content-Length', audioBuffer.length)
          event.node.res.end(audioBuffer)
          return
        }
        
        throw createError({
          statusCode: 500,
          message: 'No audio data in Gemini response'
        })
      }
    } catch (error: any) {
      console.error('Gemini TTS error:', error)
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to generate speech with Gemini'
      })
    }
  }

  // MiniMax TTS (default)
  const minimaxKeys = keys.minimax
  
  if (!minimaxKeys?.key) {
    throw createError({ 
      statusCode: 401, 
      message: 'MiniMax API key required' 
    })
  }

  const selectedModel = model || 'speech-2.8-hd'
  const selectedVoice = voice_id || 'male-qn-qingse'

  async function callTTSApi(apiKey: string, endpoint: string) {
    const baseUrls = [
      endpoint.replace('/v1', ''),
      'https://api.minimax.io',
      'https://api-uw.minimax.io'
    ]
    
    let lastError: any
    for (const baseUrl of baseUrls) {
      const url = `${baseUrl}/v1/t2a_v2`
      console.log('[MiniMax TTS] Trying endpoint:', url)
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            text,
            stream,
            voice_setting: {
              voice_id: selectedVoice,
              speed,
              emotion
            },
            audio_setting: {
              format,
              sample_rate: 32000,
              bitrate: 128000
            }
          })
        })

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          const text = await response.text()
          console.error('[MiniMax TTS] Non-JSON response:', text.substring(0, 200))
          if (response.status === 404) {
            continue
          }
          throw createError({
            statusCode: response.status,
            message: `MiniMax API error: ${text.substring(0, 200)}`
          })
        }

        const data = await response.json()
        
        if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
          throw createError({
            statusCode: data.base_resp.status_code,
            message: data.base_resp.status_msg || 'MiniMax TTS failed'
          })
        }

        return { response, data }
      } catch (error: any) {
        lastError = error
        if (error.statusCode !== 404) {
          throw error
        }
      }
    }
    
    throw lastError || createError({ statusCode: 500, message: 'All MiniMax endpoints failed' })
  }

  try {
    const result = await withMiniMaxFallback(
      minimaxKeys,
      async (apiKey, endpoint) => {
        return await callTTSApi(apiKey, endpoint)
      },
      async (apiKey, endpoint) => {
        return await callTTSApi(apiKey, endpoint)
      }
    )

    const data = result.data
    const audioHex = data.audio_file || data.data?.audio
    if (!audioHex) {
      console.error('No audio in response:', data)
      throw createError({
        statusCode: 500,
        message: 'No audio returned from MiniMax API'
      })
    }

    const audioBuffer = Buffer.from(audioHex, 'hex')
    
    const contentType = format === 'mp3' ? 'audio/mpeg' : 
                        format === 'wav' ? 'audio/wav' : 
                        format === 'flac' ? 'audio/flac' : 'audio/mpeg'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', audioBuffer.length)
    
    event.node.res.end(audioBuffer)
    return
  } catch (error: any) {
    console.error('MiniMax TTS error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate speech'
    })
  }
})
