import { defineEventHandler, readBody, createError } from 'h3'

interface MiniMaxKeys {
  key: string
  endpoint?: string
  secondary?: {
    key: string
    endpoint?: string
  }
}

function isUsageLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error || '')
  const statusCode = error?.base_resp?.status_code || error?.statusCode || error?.status_code
  console.log('[isUsageLimitError] Checking:', { errorMsg, statusCode, hasBaseResp: !!error?.base_resp })
  
  return statusCode === 2063 || 
         statusCode === 2056 ||
         statusCode === 1008 ||
         errorMsg.includes('token plan only supports') || 
         errorMsg.includes('usage limit exceeded') ||
         errorMsg.includes('insufficient balance')
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
    console.log('[withMiniMaxFallback] Primary error:', error?.message, error?.base_resp)
    if (!keys.secondary?.key || !isUsageLimitError(error)) {
      throw error
    }
    
    const secondaryEndpoint = keys.secondary.endpoint || primaryEndpoint
    console.log('Primary API error, switching to secondary API')
    return fallbackFn(keys.secondary.key, secondaryEndpoint)
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { 
    text, 
    voice_id = 'male-qn-qingse', 
    model = 'speech-2.8-hd',
    speed = 1,
    emotion = 'happy',
    format = 'mp3',
    stream = false
  } = body

  const keys = event.context.keys
  const minimaxKeys = keys.minimax
  
  if (!minimaxKeys?.key) {
    throw createError({ 
      statusCode: 401, 
      message: 'MiniMax API key required' 
    })
  }

  async function callTTSApi(apiKey: string, endpoint: string) {
    const url = `${endpoint}/v1/t2a_v2`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        text,
        stream,
        voice_setting: {
          voice_id,
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

    const data = await response.json()
    
    // Check if response contains error in body (even with HTTP 200)
    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw createError({
        statusCode: data.base_resp.status_code,
        message: data.base_resp.status_msg || 'MiniMax TTS failed'
      })
    }

    return { response, data }
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

    const audioHex = data.data?.audio
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
