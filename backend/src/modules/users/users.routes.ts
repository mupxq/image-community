import { Router, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { NotFoundError } from '../../shared/errors'
import type { UsersRepository } from './users.repository'

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', '..', 'public', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
  },
})
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } })

const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
})

export function createUsersRouter(usersRepo: UsersRepository) {
  const router = Router()

  // Get user profile
  router.get('/users/:id', async (req: AuthRequest, res: Response) => {
    const user = await usersRepo.findById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    const { passwordHash: _, ...safe } = user
    res.json(safe)
  })

  // Update profile
  router.put('/users/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
    const updated = await usersRepo.updateProfile(req.userId!, req.body as any)
    if (!updated) throw new NotFoundError('用户不存在')
    const { passwordHash: _, ...safe } = updated
    res.json(safe)
  })

  // Upload avatar
  router.post('/users/avatar', requireAuth, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: '请选择图片' })
    const url = `/uploads/${req.file.filename}`
    await usersRepo.updateProfile(req.userId!, { avatar: url })
    res.json({ avatar: url })
  })

  return router
}
