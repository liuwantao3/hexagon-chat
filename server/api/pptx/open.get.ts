import { createError } from 'h3'
import { spawn } from 'child_process'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filePath = query.path as string

  if (!filePath) {
    throw createError({
      statusCode: 400,
      message: 'Missing file path parameter',
    })
  }

  console.log('[PPTX] Opening file:', filePath)

  try {
    // macOS: use 'open' command
    await new Promise<void>((resolve, reject) => {
      const process = spawn('open', [filePath], {
        detached: true,
        stdio: 'ignore',
      })

      process.on('error', (err) => {
        console.error('[PPTX] Failed to open file:', err)
        reject(err)
      })

      process.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Process exited with code ${code}`))
        }
      })
    })

    return {
      success: true,
      message: `Opened: ${filePath}`,
      path: filePath,
    }
  } catch (error: any) {
    console.error('[PPTX] Open error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to open file: ${error.message}`,
    })
  }
})
