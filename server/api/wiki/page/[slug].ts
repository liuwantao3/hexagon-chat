import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { wikiService } from '~/server/services/wiki'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const method = event.method
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    return {
      success: false,
      message: 'Slug is required'
    }
  }

  const query = event.node.req.url?.includes('userId=')
    ? Object.fromEntries(new URL(event.node.req.url || '', 'http://localhost').searchParams)
    : {}
  const userId = query.userId ? Number(query.userId) : 1

  if (method === 'GET') {
    try {
      const page = await wikiService.getPage(userId, slug)

      if (!page) {
        return {
          success: false,
          message: 'Page not found'
        }
      }

      return {
        success: true,
        page
      }
    } catch (error: any) {
      console.error('[Wiki Page] Error:', error)
      return {
        success: false,
        message: error.message
      }
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { title, content, category, summary, tags } = body

    try {
      const existing = await prisma.wikiPage.findUnique({
        where: { userId_slug: { userId, slug } }
      })

      if (!existing) {
        return {
          success: false,
          message: 'Page not found'
        }
      }

      const page = await prisma.wikiPage.update({
        where: { id: existing.id },
        data: {
          title: title || existing.title,
          content: content || existing.content,
          category: category || existing.category,
          summary: summary !== undefined ? summary : existing.summary,
          frontmatter: tags ? JSON.stringify({ tags }) : existing.frontmatter,
          updateReason: 'manual'
        }
      })

      await wikiService.log(userId, 'update_page', { pageId: page.id, slug }, `Updated page: ${page.title}`)
      await wikiService.invalidateSearchIndex(userId)

      return {
        success: true,
        page
      }
    } catch (error: any) {
      console.error('[Wiki Page] Error:', error)
      return {
        success: false,
        message: error.message
      }
    }
  }

  if (method === 'DELETE') {
    try {
      const existing = await prisma.wikiPage.findUnique({
        where: { userId_slug: { userId, slug } }
      })

      if (!existing) {
        return {
          success: false,
          message: 'Page not found'
        }
      }

      await prisma.wikiPage.delete({
        where: { id: existing.id }
      })

      await wikiService.log(userId, 'delete_page', { pageId: existing.id, slug }, `Deleted page: ${existing.title}`)
      await wikiService.invalidateSearchIndex(userId)

      return {
        success: true,
        message: 'Page deleted'
      }
    } catch (error: any) {
      console.error('[Wiki Page] Error:', error)
      return {
        success: false,
        message: error.message
      }
    }
  }

  return {
    success: false,
    message: 'Method not allowed'
  }
})