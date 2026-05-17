import { Router, type Response } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import { commentSchema, bookmarkCreateSchema, subscriptionCreateSchema } from '../follows/follows.schema'
import type { SocialService } from './social.service'

export function createSocialRouter(service: SocialService) {
  const router = Router()

  // ============ Follows ============

  router.post('/users/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await service.follow(req.userId!, req.params.id)
      res.json({ message: '关注成功' })
    } catch (err: any) {
      if (err.statusCode === 409) return res.status(409).json({ error: err.message })
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      throw err
    }
  })

  router.delete('/users/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
    await service.unfollow(req.userId!, req.params.id)
    res.json({ message: '已取消关注' })
  })

  router.get('/users/:id/follow-status', requireAuth, async (req: AuthRequest, res: Response) => {
    const status = await service.getFollowStatus(req.userId!, req.params.id)
    res.json(status)
  })

  router.get('/users/:id/followers', async (req: AuthRequest, res: Response) => {
    const followers = await service.getFollowers(req.params.id)
    res.json(followers)
  })

  router.get('/users/:id/following', async (req: AuthRequest, res: Response) => {
    const following = await service.getFollowing(req.params.id)
    res.json(following)
  })

  router.get('/users/me/mutual-followers', requireAuth, async (req: AuthRequest, res: Response) => {
    const mutuals = await service.getMutuals(req.userId!)
    res.json(mutuals)
  })

  // ============ Comments ============

  router.get('/works/:id/comments', async (req: AuthRequest, res: Response) => {
    const comments = await service.getComments(req.params.id)
    res.json(comments)
  })

  router.post('/works/:id/comments', requireAuth, validate(commentSchema), async (req: AuthRequest, res: Response) => {
    const body = req.body as any
    await service.createComment(req.params.id, req.userId!, body.content, body.parent_id)
    res.json({ message: '评论成功' })
  })

  router.delete('/comments/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    const deleted = await service.deleteComment(req.params.id, req.userId!)
    if (!deleted) return res.status(403).json({ error: '无权删除此评论' })
    res.json({ message: '评论已删除' })
  })

  // ============ Likes ============

  router.post('/works/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
    const liked = await service.toggleWorkLike(req.params.id, req.userId!)
    res.json({ liked })
  })

  router.get('/works/:id/page-likes', async (req: AuthRequest, res: Response) => {
    const userId = req.userId
    const statuses = await service.getPageLikeStatuses(req.params.id, userId ?? '')
    res.json(statuses)
  })

  router.post('/pages/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
    const liked = await service.togglePageLike(req.params.id, req.userId!)
    res.json({ liked })
  })

  // ============ Subscriptions ============

  router.get('/users/:id/subscriptions', async (req: AuthRequest, res: Response) => {
    const subs = await service.getUserSubscriptions(req.params.id)
    res.json(subs)
  })

  router.post('/subscriptions', requireAuth, validate(subscriptionCreateSchema), async (req: AuthRequest, res: Response) => {
    await service.subscribe(req.userId!, (req.body as any).work_id)
    res.json({ message: '已订阅' })
  })

  router.delete('/subscriptions/:workId', requireAuth, async (req: AuthRequest, res: Response) => {
    await service.unsubscribe(req.userId!, req.params.workId)
    res.json({ message: '已取消订阅' })
  })

  router.get('/subscriptions/check', requireAuth, async (req: AuthRequest, res: Response) => {
    const workId = req.query.work_id as string
    if (!workId) return res.json({ subscribed: false, lastViewedForkCount: 0 })
    const result = await service.checkSubscription(req.userId!, workId)
    res.json(result)
  })

  router.put('/subscriptions/:workId/viewed', requireAuth, async (req: AuthRequest, res: Response) => {
    // Count current forks and update viewed count
    await service.markViewed(req.userId!, req.params.workId, 0) // TODO: pass real fork count
    res.json({ message: '已更新' })
  })

  return router
}
