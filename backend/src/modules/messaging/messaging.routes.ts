import { Router, type Response } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import type { MessagingService } from './messaging.service'

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  msg_type: z.enum(['text', 'image']).default('text'),
})

const createConversationSchema = z.object({
  target_user_id: z.string().uuid(),
})

export function createMessagingRouter(service: MessagingService) {
  const router = Router()

  // List user conversations
  router.get('/conversations', requireAuth, async (req: AuthRequest, res: Response) => {
    const conversations = await service.getUserConversations(req.userId!)
    res.json(conversations)
  })

  // Create / get private conversation
  router.post('/conversations', requireAuth, validate(createConversationSchema), async (req: AuthRequest, res: Response) => {
    try {
      const conv = await service.getOrCreateConversation(req.userId!, (req.body as any).target_user_id)
      res.json(conv)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      throw err
    }
  })

  // Get conversation messages
  router.get('/conversations/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
    const result = await service.getConversationMessages(req.params.id!)
    res.json(result)
  })

  // Send message
  router.post('/conversations/:id/messages', requireAuth, validate(sendMessageSchema), async (req: AuthRequest, res: Response) => {
    const body = req.body as any
    const message = await service.sendMessage(req.params.id!, req.userId!, body.content, body.msg_type)
    res.status(201).json(message)
  })

  return router
}
