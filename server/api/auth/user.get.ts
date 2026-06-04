import { createError, eventHandler, getRequestHeader, H3Event } from 'h3'
import jwt from 'jsonwebtoken'
import prisma from '~/server/utils/prisma'
import { SECRET } from './login.post'

const TOKEN_TYPE = 'Bearer'

const extractToken = (authHeaderValue: string) => {
  const [, token] = authHeaderValue.split(`${TOKEN_TYPE} `)
  return token
}

const ensureAuth = async (event: H3Event) => {
  const authHeaderValue = getRequestHeader(event, 'authorization')
  if (typeof authHeaderValue === 'undefined') {
    throw createError({ statusCode: 403, statusMessage: 'Need to pass valid Bearer-authorization header to access this endpoint' })
  }

  const extractedToken = extractToken(authHeaderValue)
  try {
    const decoded = jwt.verify(extractedToken, SECRET as string) as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { access_token: true, is_active: true }
    })
    
    if (user && user.access_token === extractedToken && user.is_active) {
      return decoded
    }
    
    throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Login failed with error:', error)
    return null
  }
}

export default eventHandler(async (event) => {
  const user = await ensureAuth(event)
  return user
})
