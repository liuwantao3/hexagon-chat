import { writeFile, mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

const IMAGE_DIR = join(process.cwd(), 'public', 'images', 'stories')

export async function ensureImageDir() {
  if (!existsSync(IMAGE_DIR)) {
    await mkdir(IMAGE_DIR, { recursive: true })
  }
}

export async function saveImageFile(storyId: number, imageUrl: string): Promise<string> {
  await ensureImageDir()
  
  const filename = `story-${storyId}-${Date.now()}.png`
  const filepath = join(IMAGE_DIR, filename)
  
  const response = await fetch(imageUrl)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  await writeFile(filepath, buffer)
  
  return `/images/stories/${filename}`
}

export async function deleteImageFile(imagePath: string) {
  const filepath = join(process.cwd(), 'public', imagePath)
  
  try {
    if (existsSync(filepath)) {
      unlinkSync(filepath)
    }
  } catch (e) {
    console.warn('Failed to delete image file:', filepath)
  }
}
