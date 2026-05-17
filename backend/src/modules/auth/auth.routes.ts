import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import { registerSchema, loginSchema } from './auth.schema'
import type { AuthService } from './auth.service'
import type { Response } from 'express'

export function createAuthRouter(authService: AuthService) {
  const router = Router()

  router.post('/register',
    validate(registerSchema),
    async (req: AuthRequest, res: Response) => {
      const result = await authService.register(req.body as any)
      res.status(201).json(result)
    }
  )

  router.post('/login',
    validate(loginSchema),
    async (req: AuthRequest, res: Response) => {
      const result = await authService.login(req.body as any)
      res.json(result)
    }
  )

  router.get('/me',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      const user = await authService.getMe(req.userId!)
      if (!user) {
        return res.status(404).json({ error: '用户不存在' })
      }
      res.json(user)
    }
  )

  return router
}
