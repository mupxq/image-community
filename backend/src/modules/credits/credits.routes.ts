import { Router, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import type { CreditsService } from './credits.service'

export function createCreditsRouter(service: CreditsService) {
  const router = Router()

  // Get credits status
  router.get('/credits/status', requireAuth, async (req: AuthRequest, res: Response) => {
    const status = await service.getStatus(req.userId!)
    res.json(status)
  })

  // Daily check-in
  router.post('/credits/check-in', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.checkIn(req.userId!)
      res.json(result)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      throw err
    }
  })

  // Get credit logs
  router.get('/credits/logs', requireAuth, async (req: AuthRequest, res: Response) => {
    const logs = await service.getLogs(req.userId!)
    res.json(logs)
  })

  return router
}
