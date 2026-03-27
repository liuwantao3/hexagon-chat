import type { DefineLocaleMessage } from 'vue-i18n'
import type enUs from './locales/en-US.json'

declare module 'vue-i18n' {
  type En = typeof enUs

  export interface DefineLocaleMessage extends En { }
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    kb: {
      create: {
        role: string
      }
    },
    modelProxyEnabled: boolean
    chatMaxAttachedMessages: number
    appName: string
  }
}

declare global {
  interface Window {
    CodeExecutionHandler?: {
      execute: (code: string, language: string) => Promise<{ output: string; error?: string }>
    }
  }
}

export { }
