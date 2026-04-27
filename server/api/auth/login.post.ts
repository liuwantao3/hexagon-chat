import { createError, eventHandler, readBody } from 'h3'
import prisma from "@/server/utils/prisma"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { Role } from './signup.post'
import { chatService } from '~/server/services/chat'

const refreshTokens: Record<number, Record<string, any>> = {}
const SECRET = process.env.SECRET
if (!SECRET) {
  throw new Error('SECRET environment variable is required. Please set it before starting the server.')
}
export { SECRET }

const validate = async (name: string, password: string) => {
  if (!name || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and password cannot be empty'
    })
  }

  const exist = await prisma.user.findUnique({ where: { name: name } })
  if (!exist) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid user name and password`
    })
  }

  const match = bcrypt.compareSync(password, exist.password)
  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid user name and password`
    })
  }

  return exist
}

export default eventHandler(async (event) => {
  const { username, password } = await readBody(event)

  const userRecord = await validate(username, password)

  const expiresIn = 365 * 24 * 60 * 60
  const refreshToken = Math.floor(Math.random() * (1000000000000000 - 1 + 1)) + 1
  let role = 'user'
  if (userRecord.role === Role.ADMIN) {
    role = 'admin'
  } else if (userRecord.role === Role.SUPERADMIN) {
    role = 'superadmin'
  }

  const user = {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    role: role
  }

  const accessToken = jwt.sign({ ...user, scope: ['test', 'user'] }, SECRET, { expiresIn })
  refreshTokens[refreshToken] = {
    accessToken,
    user
  }

  // Merge anonymous sessions if anonymousId provided
  const anonymousId = event.headers.get('x-anonymous-id')
  console.log(`[Login] anonymousId from header: ${anonymousId}`)
  if (anonymousId) {
    try {
      const mergedCount = await chatService.mergeAnonymousSessions(user.id, anonymousId)
      console.log(`[Login] Merged ${mergedCount} sessions for user ${user.id}`)
    } catch (e) {
      console.error('[Login] Error merging anonymous data:', e)
    }
  } else {
    console.log('[Login] No anonymousId header, skipping merge')
  }

  return {
    token: {
      accessToken,
      refreshToken
    }
  }
})
