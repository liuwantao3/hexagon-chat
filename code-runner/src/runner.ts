import Docker from 'dockerode'
import { v4 as uuidv4 } from 'uuid'
import { v4 as uuidv4Fs } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { ExecuteRequest, ExecuteResponse, ImageFile } from './types'

const docker = new Docker()

const DEFAULT_TIMEOUT = 30000
const MAX_MEMORY = 256 * 1024 * 1024
const MAX_CPU = 1e9

const OUTPUT_DIR = '/tmp/code-runner-output'

const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp'
}

const LANGUAGE_CONFIG: Record<string, { image: string; cmd: (code: string) => string[] }> = {
  bash: {
    image: 'bash:latest',
    cmd: (code) => ['bash', '-c', code]
  },
  sh: {
    image: 'bash:latest',
    cmd: (code) => ['sh', '-c', code]
  },
  python: {
    image: 'code-runner-python:latest',
    cmd: (code) => ['python3', '-c', code]
  },
  python3: {
    image: 'code-runner-python:latest',
    cmd: (code) => ['python3', '-c', code]
  },
  javascript: {
    image: 'node:20-slim',
    cmd: (code) => ['node', '-e', code]
  },
  node: {
    image: 'node:20-slim',
    cmd: (code) => ['node', '-e', code]
  }
}

export async function executeCode(request: ExecuteRequest): Promise<ExecuteResponse> {
  const { code, language, timeout = DEFAULT_TIMEOUT } = request

  const config = LANGUAGE_CONFIG[language]
  if (!config) {
    return {
      success: false,
      output: '',
      error: `Unsupported language: ${language}. Supported: bash, python, python3, javascript, node`,
      language,
      executionTime: 0
    }
  }

  const containerId = `code-runner-${uuidv4().slice(0, 8)}`
  const sessionOutputDir = path.join(OUTPUT_DIR, uuidv4Fs())
  const startTime = Date.now()

  let container: Docker.Container | null = null

  try {
    if (!fs.existsSync(sessionOutputDir)) {
      fs.mkdirSync(sessionOutputDir, { recursive: true })
    }

    const imageExists = await pullImageIfNeeded(config.image)
    if (!imageExists) {
      return {
        success: false,
        output: '',
        error: `Failed to pull Docker image: ${config.image}`,
        language,
        executionTime: Date.now() - startTime
      }
    }

    container = await docker.createContainer({
      name: containerId,
      Image: config.image,
      Cmd: config.cmd(code),
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Memory: MAX_MEMORY,
        NanoCpus: MAX_CPU,
        NetworkMode: 'bridge',
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        AutoRemove: true,
        Binds: [`${sessionOutputDir}:${OUTPUT_DIR}`],
        Ulimits: [
          { Name: 'nofile', Soft: 1024, Hard: 2048 },
          { Name: 'nproc', Soft: 50, Hard: 100 }
        ]
      },
      WorkingDir: OUTPUT_DIR
    })

    await container.start()

    const timeoutPromise = new Promise<ExecuteResponse>((_, reject) => {
      setTimeout(async () => {
        try {
          if (container) {
            await container.kill()
            await container.wait()
          }
        } catch (e) {
        }
        reject({ timedOut: true })
      }, timeout)
    })

    const execPromise = (async (): Promise<ExecuteResponse> => {
      const stream = await container!.logs({
        follow: true,
        stdout: true,
        stderr: true
      })

      const scanForImages = (): ImageFile[] => {
        const images: ImageFile[] = []
        try {
          console.log('[CodeRunner] scanForImages: sessionOutputDir =', sessionOutputDir)
          console.log('[CodeRunner] scanForImages: OUTPUT_DIR =', OUTPUT_DIR)
          
          if (!fs.existsSync(sessionOutputDir)) {
            console.log('[CodeRunner] sessionOutputDir does not exist')
            return images
          }
          
          const files = fs.readdirSync(sessionOutputDir)
          console.log('[CodeRunner] Files in output dir:', files)
          
          for (const file of files) {
            const ext = path.extname(file).toLowerCase()
            console.log('[CodeRunner] File:', file, 'ext:', ext, 'supported:', SUPPORTED_IMAGE_EXTENSIONS.includes(ext))
            if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
              const filePath = path.join(sessionOutputDir, file)
              const data = fs.readFileSync(filePath)
              const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
              images.push({
                filename: file,
                mimeType,
                data: data.toString('base64')
              })
            }
          }
        } catch (e) {
          console.error('[CodeRunner] Error scanning for images:', e)
        }
        return images
      }

      let output = ''
      let errorOutput = ''

      return new Promise((resolve) => {
        const chunks: Buffer[] = []
        
        if (stream && typeof stream.on === 'function') {
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
          })

          stream.on('end', async () => {
            const fullOutput = Buffer.concat(chunks).toString('utf8')
            const lines = fullOutput.split('\n').filter((line: string) => {
              const trimmed = line.trim()
              return trimmed.length > 0 && !trimmed.startsWith('\x00')
            })

            const cleanOutput = lines.join('\n')
            
            try {
              await container!.wait()
            } catch (e) {
            }

            const executionTime = Date.now() - startTime
            const images = scanForImages()

            resolve({
              success: true,
              output: cleanOutput || '(no output)',
              error: '',
              language,
              executionTime,
              images: images.length > 0 ? images : undefined
            })
          })
        } else {
          const executionTime = Date.now() - startTime
          const images = scanForImages()
          resolve({
            success: true,
            output: '(no output)',
            error: '',
            language,
            executionTime,
            images: images.length > 0 ? images : undefined
          })
        }
      })
    })()

    try {
      return await Promise.race([execPromise, timeoutPromise])
    } catch (error: any) {
      if (error.timedOut) {
        return {
          success: false,
          output: '',
          error: `Execution timed out after ${timeout / 1000} seconds`,
          language,
          executionTime: Date.now() - startTime
        }
      }
      throw error
    }

  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: error.message || 'Execution failed',
      language,
      executionTime: Date.now() - startTime
    }
  } finally {
    if (container) {
      try {
        await container.kill()
      } catch (e) {
      }
      try {
        await container.remove({ force: true })
      } catch (e) {
      }
    }
    try {
      if (fs.existsSync(sessionOutputDir)) {
        fs.rmSync(sessionOutputDir, { recursive: true, force: true })
      }
    } catch (e) {
    }
  }
}

async function pullImageIfNeeded(imageName: string): Promise<boolean> {
  try {
    const images = await docker.listImages()
    const exists = images.some(img => 
      img.RepoTags && img.RepoTags.includes(imageName)
    )

    if (exists) {
      return true
    }

    console.log(`Pulling image: ${imageName}`)
    
    await new Promise<void>((resolve, reject) => {
      docker.pull(imageName, (err: any, stream: any) => {
        if (err) {
          reject(err)
          return
        }

        docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    })

    return true
  } catch (error) {
    console.error(`Failed to pull image ${imageName}:`, error)
    return false
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await docker.ping()
    return true
  } catch {
    return false
  }
}
