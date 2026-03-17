import { defineEventHandler, readBody, createError } from 'h3'

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
  const apiKey = keys.minimax?.key
  
  if (!apiKey) {
    throw createError({ 
      statusCode: 401, 
      message: 'MiniMax API key required' 
    })
  }

  const endpoint = keys.minimax?.endpoint || 'https://api.minimaxi.com'
  const url = `${endpoint}/v1/t2a_v2`

  try {
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

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw createError({
        statusCode: response.status,
        message: error.base_resp?.status_msg || 'MiniMax TTS request failed'
      })
    }

    const data = await response.json()

    if (stream) {
      return data
    }

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
