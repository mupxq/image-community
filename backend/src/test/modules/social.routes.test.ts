import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { AuthService } from '../../modules/auth/auth.service'
import { createAuthRouter } from '../../modules/auth/auth.routes'
import { WorksRepository } from '../../modules/works/works.repository'
import { WorkPagesRepository } from '../../modules/works/workPages.repository'
import { ContributorsRepository } from '../../modules/works/contributors.repository'
import { FollowsRepository } from '../../modules/follows/follows.repository'
import { CommentsRepository } from '../../modules/comments/comments.repository'
import { LikesRepository } from '../../modules/likes/likes.repository'
import { SubscriptionsRepository } from '../../modules/subscriptions/subscriptions.repository'
import { SocialService } from '../../modules/social/social.service'
import { createSocialRouter } from '../../modules/social/social.routes'
import { errorHandler } from '../../middleware/errorHandler'
import { optionalAuth, requireAuth } from '../../middleware/auth'

function createApp(testDb: TestDb) {
  const app = express()
  app.use(express.json())

  const usersRepo = new UsersRepository(testDb.db)
  const authService = new AuthService(usersRepo)
  const worksRepo = new WorksRepository(testDb.db)
  const pagesRepo = new WorkPagesRepository(testDb.db)
  const contribRepo = new ContributorsRepository(testDb.db)
  const socialService = new SocialService(
    new FollowsRepository(testDb.db),
    new CommentsRepository(testDb.db),
    new LikesRepository(testDb.db),
    new SubscriptionsRepository(testDb.db),
  )

  app.use('/api/auth', createAuthRouter(authService))
  app.use('/api', optionalAuth, createSocialRouter(socialService))
  app.use(errorHandler)
  return app
}

describe('Social Routes', () => {
  let app: express.Express
  let testDb: TestDb
  let token: string
  let userId: string
  let token2: string
  let user2Id: string
  let workId: string
  let pageId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    app = createApp(testDb)

    const usersRepo = new UsersRepository(testDb.db)
    const authService = new AuthService(usersRepo)

    const r1 = await authService.register({ username: 'user1', password: 'pass123', nickname: 'User1' })
    token = r1.token; userId = r1.user.id
    const r2 = await authService.register({ username: 'user2', password: 'pass123', nickname: 'User2' })
    token2 = r2.token; user2Id = r2.user.id

    const worksRepo = new WorksRepository(testDb.db)
    const pagesRepo = new WorkPagesRepository(testDb.db)
    const contribRepo = new ContributorsRepository(testDb.db)
    const w = await worksRepo.create({ title: 'Test', type: 'comic', creatorId: userId, status: 'published' })
    await worksRepo.update(w.id, { rootWorkId: w.id })
    await contribRepo.create({ workId: w.id, userId, role: 'creator' })
    workId = w.id
    const page = await pagesRepo.create({ workId: w.id, pageNumber: 1, imageUrl: '/img.png' })
    pageId = page.id
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

  describe('Follows', () => {
    it('should follow a user', async () => {
      const res = await request(app)
        .post(`/api/users/${user2Id}/follow`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })

    it('should unfollow a user', async () => {
      await request(app).post(`/api/users/${user2Id}/follow`).set('Authorization', `Bearer ${token}`)
      const res = await request(app)
        .delete(`/api/users/${user2Id}/follow`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })

    it('should get follow status', async () => {
      await request(app).post(`/api/users/${user2Id}/follow`).set('Authorization', `Bearer ${token}`)
      const res = await request(app)
        .get(`/api/users/${user2Id}/follow-status`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.isFollowing).toBe(true)
    })

    it('should get followers list', async () => {
      await request(app).post(`/api/users/${user2Id}/follow`).set('Authorization', `Bearer ${token}`)
      const res = await request(app).get(`/api/users/${user2Id}/followers`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })

    it('should get mutual followers', async () => {
      await request(app).post(`/api/users/${user2Id}/follow`).set('Authorization', `Bearer ${token}`)
      await request(app).post(`/api/users/${userId}/follow`).set('Authorization', `Bearer ${token2}`)
      const res = await request(app)
        .get('/api/users/me/mutual-followers')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })
  })

  // ============ Comments ============

  describe('Comments', () => {
    it('should create a comment', async () => {
      const res = await request(app)
        .post(`/api/works/${workId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Great work!' })
      expect(res.status).toBe(200)
    })

    it('should list comments', async () => {
      await request(app).post(`/api/works/${workId}/comments`).set('Authorization', `Bearer ${token}`).send({ content: 'C1' })
      await request(app).post(`/api/works/${workId}/comments`).set('Authorization', `Bearer ${token2}`).send({ content: 'C2' })

      const res = await request(app).get(`/api/works/${workId}/comments`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
    })

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/works/${workId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('should delete own comment', async () => {
      await request(app).post(`/api/works/${workId}/comments`).set('Authorization', `Bearer ${token}`).send({ content: 'Bye' })
      const list = await request(app).get(`/api/works/${workId}/comments`)
      const commentId = list.body[0].id

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  // ============ Likes ============

  describe('Likes', () => {
    it('should toggle work like', async () => {
      const res = await request(app)
        .post(`/api/works/${workId}/like`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.liked).toBe(true)
    })

    it('should toggle page like', async () => {
      const res = await request(app)
        .post(`/api/pages/${pageId}/like`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.liked).toBe(true)
    })
  })

  // ============ Subscriptions ============

  describe('Subscriptions', () => {
    it('should subscribe to a work', async () => {
      const res = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ work_id: workId })
      expect(res.status).toBe(200)
    })

    it('should check subscription status', async () => {
      await request(app).post('/api/subscriptions').set('Authorization', `Bearer ${token}`).send({ work_id: workId })

      const res = await request(app)
        .get('/api/subscriptions/check')
        .query({ work_id: workId })
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.subscribed).toBe(true)
    })

    it('should unsubscribe', async () => {
      await request(app).post('/api/subscriptions').set('Authorization', `Bearer ${token}`).send({ work_id: workId })
      const res = await request(app)
        .delete(`/api/subscriptions/${workId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })
})
