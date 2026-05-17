import { Router, type Response } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import { createWorkSchema, forkWorkSchema } from './works.schema'
import type { WorksService } from './works.service'

export function createWorksRouter(worksService: WorksService) {
  const router = Router()

  // List works
  router.get('/works', async (req: AuthRequest, res: Response) => {
    const { type, sort } = req.query as { type?: string; sort?: string }
    const works = await worksService.listWorks({ type, sort })
    res.json(works)
  })

  // Get work detail
  router.get('/works/:id', async (req: AuthRequest, res: Response) => {
    const work = await worksService.getWork(req.params.id)
    if (!work) return res.status(404).json({ error: '作品不存在' })
    res.json(work)
  })

  // Get pages
  router.get('/works/:id/pages', async (req: AuthRequest, res: Response) => {
    const pages = await worksService.getPages(req.params.id)
    res.json(pages)
  })

  // Get creation tree
  router.get('/works/:id/tree', async (req: AuthRequest, res: Response) => {
    try {
      const tree = await worksService.getTree(req.params.id)
      res.json(tree)
    } catch (err: any) {
      if (err.message === '作品不存在') return res.status(404).json({ error: err.message })
      throw err
    }
  })

  // Get branches at a page
  router.get('/works/:id/branches', async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page)
    if (!page || page < 1) return res.status(400).json({ error: 'page 参数必填且大于0' })

    const branches = await worksService.getBranches(req.params.id, page)
    res.json(branches)
  })

  // Create work
  router.post('/works',
    requireAuth,
    validate(createWorkSchema),
    async (req: AuthRequest, res: Response) => {
      const work = await worksService.createWork(req.userId!, req.body as any)
      res.status(201).json(work)
    }
  )

  // Delete work
  router.delete('/works/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await worksService.deleteWork(req.userId!, req.params.id)
      res.json({ message: '作品已删除' })
    } catch (err: any) {
      if (err.statusCode === 404) return res.status(404).json({ error: err.message })
      if (err.statusCode === 403) return res.status(403).json({ error: err.message })
      throw err
    }
  })

  // Fork work
  router.post('/works/:id/fork',
    requireAuth,
    validate(forkWorkSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        const forked = await worksService.forkWork(req.userId!, req.params.id, req.body as any)
        res.status(201).json(forked)
      } catch (err: any) {
        if (err.statusCode === 404) return res.status(404).json({ error: err.message })
        if (err.statusCode === 403) return res.status(403).json({ error: err.message })
        throw err
      }
    }
  )

  return router
}
