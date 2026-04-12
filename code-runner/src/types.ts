export interface ExecuteRequest {
  code: string
  language: 'bash' | 'python' | 'python3' | 'javascript' | 'node' | 'sh'
  timeout?: number
}

export interface ImageFile {
  filename: string
  mimeType: string
  data: string
}

export interface ExecuteResponse {
  success: boolean
  output: string
  error: string
  language: string
  executionTime: number
  images?: ImageFile[]
}

export interface ContainerConfig {
  Image: string
  Cmd: string[]
  AttachStdout: boolean
  AttachStderr: boolean
  Env?: string[]
  HostConfig: {
    Memory: number
    NanoCpus: number
    NetworkMode: string
    CapDrop: string[]
    SecurityOpt: string[]
    AutoRemove: boolean
    Ulimits: { Name: string; Soft: number; Hard: number }[]
  }
}
