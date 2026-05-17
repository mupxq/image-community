import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { WorksRepository } from '../../modules/works/works.repository'
import { WorkPagesRepository } from '../../modules/works/workPages.repository'
import { ContributorsRepository } from '../../modules/works/contributors.repository'
import { FollowsRepository } from '../../modules/follows/follows.repository'
import { CommentsRepository } from '../../modules/comments/comments.repository'
import { LikesRepository } from '../../modules/likes/likes.repository'
import { SubscriptionsRepository } from '../../modules/subscriptions/subscriptions.repository'
import { SocialService } from '../../modules/social/social.service'

describe('SocialService', () => {
  let testDb: TestDb
  let service: SocialService
  let userId: string
  let user2Id: string
  let workId: string
  let pageId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()

    const usersRepo = new UsersRepository(testDb.db)
    const worksRepo = new WorksRepository(testDb.db)
    const pagesRepo = new WorkPagesRepository(testDb.db)
    const contribRepo = new ContributorsRepository(testDb.db)

    const u1 = await usersRepo.create({ username: 'user1', passwordHash: 'x', nickname: 'User1' })
    const u2 = await usersRepo.create({ username: 'user2', passwordHash: 'x', nickname: 'User2' })
    userId = u1.id
    user2Id = u2.id

    const w = await worksRepo.create({ title: 'Test', type: 'comic', creatorId: userId, status: 'published' })
    await worksRepo.update(w.id, { rootWorkId: w.id })
    await contribRepo.create({ workId: w.id, userId, role: 'creator' })
    workId = w.id

    const p = await pagesRepo.create({ workId, pageNumber: 1, imageUrl: '/img.png' })
    pageId = p.id

    service = new SocialService(
      new FollowsRepository(testDb.db),
      new CommentsRepository(testDb.db),
      new LikesRepository(testDb.db),
      new SubscriptionsRepository(testDb.db),
    )
  })

  afterAll(async () => { await testDb.teardown() })

  beforeEach(async () => {
    const { pageLikes, workLikes, comments, follows, subscriptions } = await import('../../db/schema')
    await testDb.db.delete(pageLikes)
    await testDb.db.delete(workLikes)
    await testDb.db.delete(comments)
    await testDb.db.delete(follows)
    await testDb.db.delete(subscriptions)
  })

  // ============ Follows ============

  describe('follows', () => {
    it('should follow and unfollow', async () => {
      await service.follow(userId, user2Id)
      expect(await service.isFollowing(userId, user2Id)).toBe(true)

      await service.unfollow(userId, user2Id)
      expect(await service.isFollowing(userId, user2Id)).toBe(false)
    })

    it('should reject following self', async () => {
      await expect(service.follow(userId, userId)).rejects.toThrow('不能关注自己')
    })

    it('should get follow status', async () => {
      await service.follow(userId, user2Id)
      const status = await service.getFollowStatus(userId, user2Id)
      expect(status.isFollowing).toBe(true)
      expect(status.isFollowedBy).toBe(false)
    })
  })

  // ============ Comments ============

  describe('comments', () => {
    it('should create and list comments', async () => {
      await service.createComment(workId, userId, 'Great!')
      await service.createComment(workId, user2Id, 'Nice')

      const comments = await service.getComments(workId)
      expect(comments).toHaveLength(2)
    })

    it('should create a reply', async () => {
      const parent = await service.createComment(workId, userId, 'Parent')
      await service.createComment(workId, user2Id, 'Reply', parent.id)

      const comments = await service.getComments(workId)
      expect(comments).toHaveLength(2)
      const reply = comments.find((c: any) => c.parent_id)
      expect(reply).toBeTruthy()
    })

    it('should delete own comment', async () => {
      const c = await service.createComment(workId, userId, 'Bye')
      const deleted = await service.deleteComment(c.id, userId)
      expect(deleted).toBe(true)
    })

    it('should reject deleting others comment', async () => {
      const c = await service.createComment(workId, userId, 'Mine')
      const deleted = await service.deleteComment(c.id, user2Id)
      expect(deleted).toBe(false)
    })
  })

  // ============ Likes ============

  describe('likes', () => {
    it('should toggle work like', async () => {
      const liked = await service.toggleWorkLike(workId, userId)
      expect(liked).toBe(true)

      const unliked = await service.toggleWorkLike(workId, userId)
      expect(unliked).toBe(false)
    })

    it('should toggle page like', async () => {
      const liked = await service.togglePageLike(pageId, userId)
      expect(liked).toBe(true)

      const unliked = await service.togglePageLike(pageId, userId)
      expect(unliked).toBe(false)
    })

    it('should get work like status', async () => {
      await service.toggleWorkLike(workId, userId)
      const status = await service.getWorkLikeStatus(workId, userId)
      expect(status.liked).toBe(true)
      expect(status.likeCount).toBe(1)
    })

    it('should get page like statuses', async () => {
      await service.togglePageLike(pageId, userId)
      const statuses = await service.getPageLikeStatuses(workId, user2Id)
      expect(statuses).toHaveLength(1)
    })
  })

  // ============ Subscriptions ============

  describe('subscriptions', () => {
    it('should subscribe and unsubscribe', async () => {
      await service.subscribe(userId, workId)
      const sub = await service.checkSubscription(userId, workId)
      expect(sub.subscribed).toBe(true)

      await service.unsubscribe(userId, workId)
      const after = await service.checkSubscription(userId, workId)
      expect(after.subscribed).toBe(false)
    })
  })
})
