import { readFileSync, existsSync } from 'fs'
import { extname, resolve } from 'path'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

function getMimeType(filename) {
  const ext = extname(filename).toLowerCase()
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export const displayImageTool = {
  name: 'display_image',
  description: `Display an image file in the chat window.
- Takes an image file path and displays it in the chat
- Use this after generating images (plots, charts, etc.) to show them to the user
- Supports PNG, JPG, JPEG, GIF, BMP, WEBP`,

  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the image file (absolute or relative to current directory)'
      }
    },
    required: ['path']
  },

  async execute(params) {
    const { path } = params
    const cwd = process.cwd()
    
    const imagePath = path.startsWith('/') ? path : resolve(cwd, path)
    
    console.log('[DisplayImageTool] path:', path)
    console.log('[DisplayImageTool] resolved path:', imagePath)
    
    if (!existsSync(imagePath)) {
      return JSON.stringify({
        success: false,
        error: `Image file not found: ${imagePath}`
      })
    }
    
    const ext = extname(imagePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return JSON.stringify({
        success: false,
        error: `Not an image file: ${ext}. Supported: ${IMAGE_EXTENSIONS.join(', ')}`
      })
    }
    
    try {
      const imgData = readFileSync(imagePath)
      const base64 = imgData.toString('base64')
      const mimeType = getMimeType(imagePath)
      const dataUrl = `data:${mimeType};base64,${base64}`
      
      console.log('[DisplayImageTool] Image loaded:', imagePath, 'size:', dataUrl.length)
      
      return JSON.stringify({
        success: true,
        markdown: `Image: ${imagePath}`,
        imageUrls: [dataUrl]
      })
    } catch (e) {
      console.log('[DisplayImageTool] Error reading image:', e)
      return JSON.stringify({
        success: false,
        error: `Failed to read image: ${e.message}`
      })
    }
  }
}

export default [displayImageTool]