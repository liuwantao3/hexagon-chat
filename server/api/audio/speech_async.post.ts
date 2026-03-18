import { defineEventHandler, readBody, createError } from 'h3'
import * as tar from 'tar-stream'
import { Readable } from 'stream'

interface SentenceTimestamp {
  text: string
  start_time: number
  end_time: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { 
    text, 
    voice_id = 'male-qn-qingse', 
    model = 'speech-2.8-hd',
    speed = 1,
    emotion = 'happy',
    format = 'mp3'
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

  try {
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

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({}))
      console.error('MiniMax API error response:', error)
      throw createError({
        statusCode: createResponse.status,
        message: error.base_resp?.status_msg || error.msg || 'Failed to create TTS task'
      })
    }

    const taskData = await createResponse.json()
    console.log('Task created response:', JSON.stringify(taskData))
    const taskId = taskData.task_id

    if (!taskId) {
      throw createError({
        statusCode: 500,
        message: 'No task ID returned'
      })
    }

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
        console.log(`Status check ${retries} failed with ${statusResponse.status}`)
        retries++
        continue
      }

      const statusData = await statusResponse.json()
      console.log(`Status check ${retries}: status=${statusData.status}`)
      console.log(`Status data keys:`, Object.keys(statusData))
      if (statusData.data) {
        console.log(`Status data.data keys:`, Object.keys(statusData.data))
        console.log(`Has subtitle:`, !!statusData.data.subtitle)
        console.log(`Subtitle preview:`, (statusData.data.subtitle || '').substring(0, 200))
      }
      
      if (statusData.status === 'Success') {
        const fileId = statusData.file_id
        const subtitles = statusData.data?.subtitle || statusData.subtitle
        
        if (!fileId) {
          throw createError({
            statusCode: 500,
            message: 'No file_id in response'
          })
        }

        const downloadResponse = await fetch(`${endpoint}/v1/files/retrieve?file_id=${fileId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        if (!downloadResponse.ok) {
          console.log('Download metadata failed, retrying...')
          retries++
          continue
        }

        const downloadData = await downloadResponse.json()
        const downloadUrl = downloadData.file?.download_url
        
        if (!downloadUrl) {
          console.log('No download URL found, retrying...')
          retries++
          continue
        }

        const audioResponse = await fetch(downloadUrl)
        if (!audioResponse.ok) {
          console.log('Audio download failed, retrying...')
          retries++
          continue
        }

        const audioBuffer = await audioResponse.arrayBuffer()
        let audioHex = ''
        let subtitleText = subtitles || ''
        
        try {
          const extract = tar.extract()
          const audioData = await new Promise<Buffer>((resolve, reject) => {
            const audioChunks: Buffer[] = []
            extract.on('entry', (header, stream, next) => {
              console.log(`Tar entry: ${header.name}, size: ${header.size}`)
              const isAudio = header.name.endsWith('.mp3') || header.name.endsWith('.wav') || header.name.endsWith('.m4a')
              const isSubtitle = header.name.endsWith('.titles') || header.name.endsWith('.srt') || header.name.includes('subtitle')
              const isExtra = header.name.endsWith('.extra')
              console.log(`  isAudio: ${isAudio}, isSubtitle: ${isSubtitle}, isExtra: ${isExtra}`)
              
              stream.on('data', (chunk: Buffer) => {
                if (isAudio) {
                  audioChunks.push(chunk)
                } else if (isSubtitle) {
                  const text = chunk.toString('utf8')
                  if (!subtitleText) {
                    subtitleText = text
                  }
                } else if (isExtra) {
                  // Skip extra file
                }
              })
              stream.on('end', next)
              stream.on('error', reject)
            })
            extract.on('finish', () => {
              if (audioChunks.length > 0) {
                resolve(Buffer.concat(audioChunks))
              } else {
                reject(new Error('No audio found in tar'))
              }
            })
            extract.on('error', reject)
            
            const readable = Readable.from(Buffer.from(audioBuffer))
            readable.pipe(extract)
          })
          audioHex = audioData.toString('hex')
        } catch (extractError) {
          console.log('Tar extraction failed, trying raw audio:', extractError)
          audioHex = Buffer.from(audioBuffer).toString('hex')
        }
        
        console.log(`Audio extracted, subtitle text length: ${subtitleText.length}`)
        
        const sentenceTimestamps = parseSubtitles(subtitleText, text)
        
        console.log('Parsed timestamps count:', sentenceTimestamps.length)
        if (sentenceTimestamps.length > 0) {
          console.log('First timestamp:', JSON.stringify(sentenceTimestamps[0]))
          console.log('Last timestamp:', JSON.stringify(sentenceTimestamps[sentenceTimestamps.length - 1]))
        }

        return {
          task_id: taskId,
          audio_hex: audioHex,
          sentence_timestamps: sentenceTimestamps,
          duration: statusData.data?.duration || null
        }
      } else if (statusData.status === 'Failed') {
        throw createError({
          statusCode: 500,
          message: statusData.error_msg || 'TTS task failed'
        })
      }
      
      retries++
    }

    throw createError({
      statusCode: 504,
      message: 'TTS task timed out'
    })

  } catch (error: any) {
    console.error('MiniMax Async TTS error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate speech'
    })
  }
})

function parseSubtitles(subtitleText: string, originalText: string): SentenceTimestamp[] {
  if (!subtitleText) {
    const sentences = originalText.split(/[.!?\n]+/).filter(s => s.trim())
    return sentences.map((text, index) => ({
      text: text.trim(),
      start_time: index * 3.0,
      end_time: (index + 1) * 3.0
    }))
  }

  try {
    const data = JSON.parse(subtitleText)
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        text: item.text || '',
        start_time: (item.time_begin || 0) / 1000,
        end_time: (item.time_end || 0) / 1000
      }))
    }
  } catch (e) {
    console.log('Failed to parse JSON subtitles:', e)
  }

  const sentences = originalText.split(/[.!?\n]+/).filter(s => s.trim())
  return sentences.map((text, index) => ({
    text: text.trim(),
    start_time: index * 3.0,
    end_time: (index + 1) * 3.0
  }))
}
