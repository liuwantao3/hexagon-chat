import { getRequestHeader, H3Event, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { SECRET } from '../api/auth/login.post'
import prisma from '../utils/prisma'

const TOKEN_TYPE = 'Bearer'

const extractToken = (authHeaderValue: string) => {
  const [, token] = authHeaderValue.split(`${TOKEN_TYPE} `)
  return token
}

const parseAuthUser = async (event: H3Event) => {
  const authHeaderValue = getRequestHeader(event, 'Authorization')

  if (authHeaderValue != null) {
    const extractedToken = extractToken(authHeaderValue)
    try {
      const decoded = jwt.verify(extractedToken, SECRET as string) as any

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { access_token: true, is_active: true }
      })

      if (user && user.access_token === extractedToken && user.is_active) {
        return { valid: true, user: decoded }
      }

      return { revoked: true }
    } catch (error) {
      return { invalid: true }
    }
  } else {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const uri = new URL(event.path, 'http://localhost')
  const pathname = uri.pathname.replace(/\/+$/, '')

  // Skip auth middleware for non-API routes
  if (!pathname.startsWith('/api')) {
    return
  }

  // Skip auth checks for auth endpoints themselves
  if (pathname.startsWith('/api/auth')) {
    const authResult = await parseAuthUser(event)
    event.context.user = authResult?.user || null
    return
  }

  // For other API routes
  const authResult = await parseAuthUser(event)

  // No token provided - let endpoint handle it (may return anonymous/empty data)
  if (authResult === null) {
    event.context.user = null
    return
  }

  // Token was revoked by another device login
  if (authResult.revoked) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  }

  // Invalid token
  if (authResult.invalid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  event.context.user = authResult.user
})
