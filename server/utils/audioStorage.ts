import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const AUDIO_DIR = join(process.cwd(), 'public', 'audio', 'stories')

export async function ensureAudioDir() {
  if (!existsSync(AUDIO_DIR)) {
    await mkdir(AUDIO_DIR, { recursive: true })
  }
}

export async function saveAudioFile(storyId: number, audioBuffer: Buffer): Promise<string> {
  await ensureAudioDir()
  
  const filename = `story-${storyId}-${Date.now()}.mp3`
  const filepath = join(AUDIO_DIR, filename)
  
  await writeFile(filepath, audioBuffer)
  
  return `/audio/stories/${filename}`
}

export async function deleteAudioFile(audioPath: string) {
  const { unlink } = await import('fs/promises')
  const filepath = join(process.cwd(), 'public', audioPath)
  
  try {
    await unlink(filepath)
  } catch (e) {
    console.warn('Failed to delete audio file:', filepath)
  }
}
