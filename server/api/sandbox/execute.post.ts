import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { html, css, js } = body

  return {
    success: true,
    message: 'Code received. Apply this to your sandbox state.',
    received: {
      htmlLength: html?.length || 0,
      cssLength: css?.length || 0,
      jsLength: js?.length || 0
    }
  }
})
