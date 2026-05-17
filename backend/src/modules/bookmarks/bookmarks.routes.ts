import { Router, type Response } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import { bookmarkCreateSchema, bookmarkUpdateSchema } from '../follows/follows.schema'
import type { BookmarksService } from './bookmarks.service'

export function createBookmarksRouter(service: BookmarksService) {
  const router = Router()

  // List user bookmarks
  router.get('/bookmarks', requireAuth, async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string | undefined
    const bookmarks = await service.getUserBookmarks(req.userId!, status)
    res.json(bookmarks)
  })

  // Add bookmark
  router.post('/bookmarks', requireAuth, validate(bookmarkCreateSchema), async (req: AuthRequest, res: Response) => {
    const bookmark = await service.addBookmark(req.userId!, (req.body as any).work_id)
    res.status(201).json(bookmark)
  })

  // Check bookmark status
  router.get('/bookmarks/check', requireAuth, async (req: AuthRequest, res: Response) => {
    const workId = req.query.work_id as string
    if (!workId) return res.json({ bookmarked: false, bookmark: null })
    const result = await service.checkBookmark(req.userId!, workId)
    res.json(result)
  })

  // Update bookmark
  router.put('/bookmarks/:workId', requireAuth, validate(bookmarkUpdateSchema), async (req: AuthRequest, res: Response) => {
    try {
      const bookmark = await service.updateBookmark(req.userId!, req.params.workId!, req.body as any)
      res.json(bookmark)
    } catch (err: any) {
      if (err.statusCode === 403) return res.status(403).json({ error: err.message })
      throw err
    }
  })

  // Remove bookmark
  router.delete('/bookmarks/:workId', requireAuth, async (req: AuthRequest, res: Response) => {
    await service.removeBookmark(req.userId!, req.params.workId!)
    res.json({ message: '已移除书签' })
  })

  return router
}
