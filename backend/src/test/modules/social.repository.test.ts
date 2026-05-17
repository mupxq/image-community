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

describe('Social Repositories', () => {
  let testDb: TestDb
  let usersRepo: UsersRepository
  let worksRepo: WorksRepository
  let followsRepo: FollowsRepository
  let commentsRepo: CommentsRepository
  let likesRepo: LikesRepository
  let subsRepo: SubscriptionsRepository

  let userId: string
  let user2Id: string
  let workId: string
  let pageId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    usersRepo = new UsersRepository(testDb.db)
    worksRepo = new WorksRepository(testDb.db)
    const pagesRepo = new WorkPagesRepository(testDb.db)
    const contribRepo = new ContributorsRepository(testDb.db)
    followsRepo = new FollowsRepository(testDb.db)
    commentsRepo = new CommentsRepository(testDb.db)
    likesRepo = new LikesRepository(testDb.db)
    subsRepo = new SubscriptionsRepository(testDb.db)

    // Seed: 2 users + 1 work with 1 page
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
  })

  afterAll(async () => { await testDb.teardown() })

  beforeEach(async () => {
    // Clean social tables only, keep base users/works/pages
    const { creditLogs, checkIns, generationTasks, userAiConfigs,
      messages, conversationMembers, conversations,
      subscriptions, bookmarks, pageLikes, workLikes, comments, follows } = await import('../../db/schema')
    await testDb.db.delete(pageLikes)
    await testDb.db.delete(workLikes)
    await testDb.db.delete(comments)
    await testDb.db.delete(follows)
    await testDb.db.delete(subscriptions)
  })

  // ============ FollowsRepository ============

  describe('FollowsRepository', () => {
    it('should follow a user', async () => {
      const follow = await followsRepo.create({ followerId: userId, followingId: user2Id })
      expect(follow.followerId).toBe(userId)
      expect(follow.followingId).toBe(user2Id)
    })

    it('should reject duplicate follow', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      await expect(followsRepo.create({ followerId: userId, followingId: user2Id }))
        .rejects.toThrow()
    })

    it('should unfollow', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      const deleted = await followsRepo.delete(userId, user2Id)
      expect(deleted).toBe(true)
    })

    it('should return false when unfollowing non-existent', async () => {
      const deleted = await followsRepo.delete(userId, user2Id)
      expect(deleted).toBe(false)
    })

    it('should check follow status', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      expect(await followsRepo.isFollowing(userId, user2Id)).toBe(true)
      expect(await followsRepo.isFollowing(user2Id, userId)).toBe(false)
    })

    it('should count followers and following', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      expect(await followsRepo.countFollowing(userId)).toBe(1)
      expect(await followsRepo.countFollowers(user2Id)).toBe(1)
    })

    it('should find followers list', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      const followers = await followsRepo.findFollowers(user2Id)
      expect(followers).toHaveLength(1)
      expect(followers[0].nickname).toBe('User1')
    })

    it('should find following list', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      const following = await followsRepo.findFollowing(userId)
      expect(following).toHaveLength(1)
      expect(following[0].nickname).toBe('User2')
    })

    it('should find mutual followers', async () => {
      await followsRepo.create({ followerId: userId, followingId: user2Id })
      await followsRepo.create({ followerId: user2Id, followingId: userId })
      const mutuals = await followsRepo.findMutuals(userId)
      expect(mutuals).toHaveLength(1)
      expect(mutuals[0].nickname).toBe('User2')
    })
  })

  // ============ CommentsRepository ============

  describe('CommentsRepository', () => {
    it('should create a comment', async () => {
      const comment = await commentsRepo.create({
        workId, userId, content: 'Great work!',
      })
      expect(comment.content).toBe('Great work!')
      expect(comment.workId).toBe(workId)
    })

    it('should create a reply', async () => {
      const parent = await commentsRepo.create({ workId, userId, content: 'Parent' })
      const reply = await commentsRepo.create({
        workId, userId: user2Id, content: 'Reply', parentId: parent.id,
      })
      expect(reply.parentId).toBe(parent.id)
    })

    it('should find comments by work', async () => {
      await commentsRepo.create({ workId, userId, content: 'C1' })
      await commentsRepo.create({ workId, userId: user2Id, content: 'C2' })

      const comments = await commentsRepo.findByWorkId(workId)
      expect(comments).toHaveLength(2)
    })

    it('should delete a comment', async () => {
      const c = await commentsRepo.create({ workId, userId, content: 'Bye' })
      const deleted = await commentsRepo.delete(c.id, userId)
      expect(deleted).toBe(true)
    })

    it('should reject deleting others comment', async () => {
      const c = await commentsRepo.create({ workId, userId, content: 'Mine' })
      const deleted = await commentsRepo.delete(c.id, user2Id)
      expect(deleted).toBe(false)
    })

    it('should count comments by work', async () => {
      await commentsRepo.create({ workId, userId, content: 'C1' })
      await commentsRepo.create({ workId, userId, content: 'C2' })
      const count = await commentsRepo.countByWorkId(workId)
      expect(count).toBe(2)
    })
  })

  // ============ LikesRepository ============

  describe('LikesRepository', () => {
    it('should like a work', async () => {
      const like = await likesRepo.likeWork(workId, userId)
      expect(like.workId).toBe(workId)
    })

    it('should unlike a work', async () => {
      await likesRepo.likeWork(workId, userId)
      const unliked = await likesRepo.unlikeWork(workId, userId)
      expect(unliked).toBe(true)
    })

    it('should check if user liked a work', async () => {
      await likesRepo.likeWork(workId, userId)
      expect(await likesRepo.isWorkLiked(workId, userId)).toBe(true)
      expect(await likesRepo.isWorkLiked(workId, user2Id)).toBe(false)
    })

    it('should count work likes', async () => {
      await likesRepo.likeWork(workId, userId)
      expect(await likesRepo.countWorkLikes(workId)).toBe(1)
    })

    it('should like a page', async () => {
      const like = await likesRepo.likePage(pageId, userId)
      expect(like.pageId).toBe(pageId)
    })

    it('should unlike a page', async () => {
      await likesRepo.likePage(pageId, userId)
      const unliked = await likesRepo.unlikePage(pageId, userId)
      expect(unliked).toBe(true)
    })

    it('should count page likes', async () => {
      await likesRepo.likePage(pageId, userId)
      expect(await likesRepo.countPageLikes(pageId)).toBe(1)
    })

    it('should get page likes status for a work', async () => {
      await likesRepo.likePage(pageId, userId)
      const statuses = await likesRepo.getPageLikeStatuses(workId, user2Id)
      expect(statuses).toHaveLength(1)
      expect(statuses[0].liked).toBe(false)
    })
  })

  // ============ SubscriptionsRepository ============

  describe('SubscriptionsRepository', () => {
    it('should subscribe to a work', async () => {
      const sub = await subsRepo.create({ userId, workId, lastViewedForkCount: 0 })
      expect(sub.workId).toBe(workId)
    })

    it('should unsubscribe', async () => {
      await subsRepo.create({ userId, workId })
      const deleted = await subsRepo.delete(userId, workId)
      expect(deleted).toBe(true)
    })

    it('should check subscription status', async () => {
      await subsRepo.create({ userId, workId })
      const sub = await subsRepo.findByUserAndWork(userId, workId)
      expect(sub).toBeTruthy()
    })

    it('should find subscriptions by user', async () => {
      await subsRepo.create({ userId, workId })
      const subs = await subsRepo.findByUserId(userId)
      expect(subs).toHaveLength(1)
    })

    it('should update viewed fork count', async () => {
      await subsRepo.create({ userId, workId })
      await subsRepo.updateViewedCount(userId, workId, 5)
      const sub = await subsRepo.findByUserAndWork(userId, workId)
      expect(sub!.lastViewedForkCount).toBe(5)
    })
  })
})
