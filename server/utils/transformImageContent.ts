import { MODEL_FAMILIES } from '~/config'

export function transformImageContent(content: any[], family: string): any[] {
  return content.map((item) => {
    if (item.type !== 'image_url' || !item.image_url) {
      return item
    }

    let base64 = item.image_url
    let mimeType = 'image/jpeg'
    let dataUrl: string

    if (base64.startsWith('data:')) {
      const parts = base64.split(',')
      if (parts.length >= 2) {
        const mimeMatch = parts[0].match(/:(.*?);/)
        if (mimeMatch) {
          mimeType = mimeMatch[1]
        }
        dataUrl = base64
      } else {
        dataUrl = base64
      }
    } else {
      dataUrl = `data:${mimeType};base64,${base64}`
    }

    switch (family) {
      case MODEL_FAMILIES.anthropic:
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data
          }
        }

      case MODEL_FAMILIES.gemini:
        return {
          type: 'image_url',
          image_url: {
            url: dataUrl
          }
        }

      case MODEL_FAMILIES.minimax:
      case MODEL_FAMILIES.openai:
      case MODEL_FAMILIES.azureOpenai:
      case MODEL_FAMILIES.groq:
      case MODEL_FAMILIES.moonshot:
      default:
        return {
          type: 'image_url',
          image_url: {
            url: dataUrl
          }
        }
    }
  })
}
