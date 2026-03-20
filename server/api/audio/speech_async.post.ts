import { defineEventHandler, readBody, createError } from 'h3'
import * as tar from 'tar-stream'
import { Readable } from 'stream'

interface SentenceTimestamp {
  text: string
  start_time: number
  end_time: number
}

interface MiniMaxKeys {
  key: string
  endpoint?: string
  secondary?: {
    key: string
    endpoint?: string
  }
}

const MAX_CHARS = 1000

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

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  const sentences = text.split(/([.!?\n]+)/).reduce((acc: string[], part, i) => {
    if (i % 2 === 0 && part) acc.push(part)
    else if (part && acc.length > 0) acc[acc.length - 1] += part
    return acc
  }, []).map(s => s.trim()).filter(s => s)

  let currentChunk = ''

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function createTTSTask(text: string, apiKey: string, endpoint: string, model: string, voice_id: string, speed: number, emotion: string, format: string): Promise<string> {
  console.log('[createTTSTask] Request:', { model, textLength: text.length, endpoint })
  
  const createResponse = await fetch(`${endpoint}/v1/t2a_async_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      text,
      voice_setting: {
        voice_id,
        speed,
        emotion
      },
      audio_setting: {
        format,
        sample_rate: 32000,
        bitrate: 128000
      },
      subtitle_config: {
        subtitle_type: "srt"
      }
    })
  })

  const responseText = await createResponse.text()
  console.log('[createTTSTask] Response status:', createResponse.status)
  console.log('[createTTSTask] Response body:', responseText.substring(0, 500))
  
  if (!createResponse.ok) {
    let error: any = {}
    try {
      error = JSON.parse(responseText)
    } catch (e) {}
    throw new Error(error.base_resp?.status_msg || error.msg || `Failed to create TTS task: ${createResponse.status}`)
  }

  let taskData
  try {
    taskData = JSON.parse(responseText)
  } catch (e) {
    throw new Error('Failed to parse task response')
  }
  
  console.log('[createTTSTask] Parsed task data:', JSON.stringify(taskData).substring(0, 200))
  
  if (!taskData.task_id) {
    throw new Error(`No task ID returned. Response: ${JSON.stringify(taskData).substring(0, 200)}`)
  }

  return taskData.task_id
}

async function waitForTaskCompletion(taskId: string, apiKey: string, endpoint: string): Promise<{ audioBuffer: ArrayBuffer, duration: number, subtitles: string }> {
  let retries = 0
  const maxRetries = 90

  while (retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 2000))

    const statusResponse = await fetch(`${endpoint}/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!statusResponse.ok) {
      retries++
      continue
    }

    const statusData = await statusResponse.json()

    if (statusData.status === 'Success') {
      const fileId = statusData.file_id
      const subtitles = statusData.data?.subtitle || statusData.subtitle || ''

      if (!fileId) {
        throw new Error('No file_id in response')
      }

      const downloadResponse = await fetch(`${endpoint}/v1/files/retrieve?file_id=${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!downloadResponse.ok) {
        retries++
        continue
      }

      const downloadData = await downloadResponse.json()
      const downloadUrl = downloadData.file?.download_url

      if (!downloadUrl) {
        retries++
        continue
      }

      const audioResponse = await fetch(downloadUrl)
      if (!audioResponse.ok) {
        retries++
        continue
      }

      const audioBuffer = await audioResponse.arrayBuffer()
      const duration = statusData.data?.duration || 0

      return { audioBuffer, duration, subtitles }
    } else if (statusData.status === 'Failed') {
      throw new Error(statusData.error_msg || 'TTS task failed')
    }

    retries++
  }

  throw new Error('TTS task timed out')
}

async function extractAudioAndSubtitlesFromTar(audioBuffer: ArrayBuffer): Promise<{ audio: Buffer, subtitles: string }> {
  const extract = tar.extract()
  return new Promise<{ audio: Buffer, subtitles: string }>((resolve, reject) => {
    const audioChunks: Buffer[] = []
    let subtitleText = ''
    const fileNames: string[] = []
    extract.on('entry', (header, stream, next) => {
      fileNames.push(header.name)
      const isAudio = header.name.endsWith('.mp3') || header.name.endsWith('.wav') || header.name.endsWith('.m4a')
      const isSubtitle = header.name.endsWith('.titles') || header.name.endsWith('.srt') || header.name.includes('subtitle') || header.name.endsWith('.title') || header.name.endsWith('.json')
      stream.on('data', (chunk: Buffer) => {
        if (isAudio) {
          audioChunks.push(chunk)
        } else if (isSubtitle) {
          subtitleText += chunk.toString('utf8')
        }
      })
      stream.on('end', next)
      stream.on('error', reject)
    })
    extract.on('finish', () => {
      console.log('Tar files found:', fileNames)
      if (audioChunks.length > 0) {
        resolve({ audio: Buffer.concat(audioChunks), subtitles: subtitleText })
      } else {
        reject(new Error('No audio found in tar'))
      }
    })
    extract.on('error', reject)

    const readable = Readable.from(Buffer.from(audioBuffer))
    readable.pipe(extract)
  })
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
    include_timestamps = false
  } = body

  const keys = event.context.keys
  const minimaxKeys = keys.minimax
  
  if (!minimaxKeys?.key) {
    throw createError({ 
      statusCode: 401, 
      message: 'MiniMax API key required' 
    })
  }

  try {
    const result = await withMiniMaxFallback(
      minimaxKeys,
      async (apiKey, endpoint) => {
        return await generateTTS(text, apiKey, endpoint, { voice_id, model, speed, emotion, format })
      },
      async (apiKey, endpoint) => {
        return await generateTTS(text, apiKey, endpoint, { voice_id, model, speed, emotion, format })
      }
    )

    return result

  } catch (error: any) {
    console.error('MiniMax Async TTS error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate speech'
    })
  }
})

async function generateTTS(
  text: string,
  apiKey: string,
  endpoint: string,
  options: { voice_id: string, model: string, speed: number, emotion: string, format: string }
) {
  const chunks = splitTextIntoChunks(text, MAX_CHARS)
  console.log(`Split text into ${chunks.length} chunks (max ${MAX_CHARS} chars each)`)

  const allAudioBuffers: Buffer[] = []
  const allTimestamps: SentenceTimestamp[] = []
  let accumulatedDuration = 0

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunks[i].substring(0, 50)}...`)

    const taskId = await createTTSTask(
      chunks[i], apiKey, endpoint,
      options.model, options.voice_id, options.speed, options.emotion, options.format
    )

    const { audioBuffer, subtitles } = await waitForTaskCompletion(taskId, apiKey, endpoint)

    let extracted: { audio: Buffer, subtitles: string }
    try {
      extracted = await extractAudioAndSubtitlesFromTar(audioBuffer)
    } catch {
      extracted = { audio: Buffer.from(audioBuffer), subtitles: subtitles }
    }

    allAudioBuffers.push(extracted.audio)

    const chunkTimestamps = parseSubtitles(extracted.subtitles, chunks[i], accumulatedDuration)
    allTimestamps.push(...chunkTimestamps)

    let chunkDuration: number
    if (chunkTimestamps.length > 0) {
      chunkDuration = chunkTimestamps[chunkTimestamps.length - 1].end_time - accumulatedDuration
    } else {
      chunkDuration = extracted.audio.length / 16000
    }

    console.log(`Chunk ${i + 1} timestamps:`, JSON.stringify(chunkTimestamps.slice(0, 3)))
    console.log(`Chunk ${i + 1} calculated duration: ${chunkDuration}s`)

    accumulatedDuration += chunkDuration
    console.log(`Chunk ${i + 1} done, accumulated: ${accumulatedDuration}s`)
  }

  console.log('All timestamps:', JSON.stringify(allTimestamps.slice(0, 5)))

  const combinedAudio = Buffer.concat(allAudioBuffers)
  const audioHex = combinedAudio.toString('hex')

  return {
    task_id: `combined_${Date.now()}`,
    audio_hex: audioHex,
    sentence_timestamps: allTimestamps,
    duration: accumulatedDuration
  }
}

function parseSubtitles(subtitleText: string, chunkText: string, offset: number): SentenceTimestamp[] {
  console.log(`Parsing subtitles, length: ${subtitleText.length}, offset: ${offset}`)
  
  if (!subtitleText) {
    console.log('No subtitles, using fallback')
    const sentences = chunkText.split(/[.!?\n]+/).filter(s => s.trim())
    return sentences.map((text, index) => ({
      text: text.trim(),
      start_time: offset + index * 3.0,
      end_time: offset + (index + 1) * 3.0
    }))
  }

  try {
    const data = JSON.parse(subtitleText)
    console.log('Parsed JSON subtitles, count:', Array.isArray(data) ? data.length : 'not array')
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        text: item.text || '',
        start_time: offset + (item.time_begin || 0) / 1000,
        end_time: offset + (item.time_end || 0) / 1000
      }))
    }
  } catch (e) {
    console.log('Failed to parse JSON subtitles, trying SRT format:', e)
  }

  console.log('Using fallback parsing')
  const sentences = chunkText.split(/[.!?\n]+/).filter(s => s.trim())
  return sentences.map((text, index) => ({
    text: text.trim(),
    start_time: offset + index * 3.0,
    end_time: offset + (index + 1) * 3.0
  }))
}
