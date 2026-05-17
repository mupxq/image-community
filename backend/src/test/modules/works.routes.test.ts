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
import { WorksService } from '../../modules/works/works.service'
import { createWorksRouter } from '../../modules/works/works.routes'
import { errorHandler } from '../../middleware/errorHandler'
import { optionalAuth, requireAuth } from '../../middleware/auth'

function createApp(testDb: TestDb) {
  const app = express()
  app.use(express.json())

  const usersRepo = new UsersRepository(testDb.db)
  const authService = new AuthService(usersRepo)
  const worksRepo = new WorksRepository(testDb.db)
  const pagesRepo = new WorkPagesRepository(testDb.db)
  const contributorsRepo = new ContributorsRepository(testDb.db)
  const worksService = new WorksService(worksRepo, pagesRepo, contributorsRepo)

  app.use('/api/auth', createAuthRouter(authService))
  app.use('/api', optionalAuth, createWorksRouter(worksService))
  app.use(errorHandler)
  return app
}

describe('Works Routes', () => {
  let app: express.Express
  let testDb: TestDb
  let token: string
  let userId: string
  let token2: string
  let user2Id: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    app = createApp(testDb)

    const usersRepo = new UsersRepository(testDb.db)
    const authService = new AuthService(usersRepo)
    const r1 = await authService.register({ username: 'creator', password: 'pass123', nickname: 'Creator' })
    token = r1.token
    userId = r1.user.id

    const r2 = await authService.register({ username: 'forker', password: 'pass123', nickname: 'Forker' })
    token2 = r2.token
    user2Id = r2.user.id
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
    // Re-register after cleanup
    const usersRepo = new UsersRepository(testDb.db)
    const authService = new AuthService(usersRepo)
    const r1 = await authService.register({ username: 'creator', password: 'pass123', nickname: 'Creator' })
    token = r1.token
    userId = r1.user.id
    const r2 = await authService.register({ username: 'forker', password: 'pass123', nickname: 'Forker' })
    token2 = r2.token
    user2Id = r2.user.id
  })

  // ============ POST /works ============

  describe('POST /api/works', () => {
    it('should create a work', async () => {
      const res = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Comic', type: 'comic' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeTruthy()
      expect(res.body.title).toBe('My Comic')
    })

    it('should create a work with pages', async () => {
      const res = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'With Pages',
          pages: [
            { image_url: '/1.png', description: 'Page 1' },
            { image_url: '/2.png' },
          ],
        })

      expect(res.status).toBe(201)

      const pagesRes = await request(app)
        .get(`/api/works/${res.body.id}/pages`)

      expect(pagesRes.body).toHaveLength(2)
    })

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/works')
        .send({ title: 'No Auth' })

      expect(res.status).toBe(401)
    })

    it('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'comic' })

      expect(res.status).toBe(400)
    })
  })

  // ============ GET /works ============

  describe('GET /api/works', () => {
    it('should list published works', async () => {
      await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Listed Work' })

      const res = await request(app).get('/api/works')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toBe('Listed Work')
    })

    it('should filter by type', async () => {
      await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Comic', type: 'comic' })

      await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Drama', type: 'drama' })

      const res = await request(app).get('/api/works?type=comic')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })
  })

  // ============ GET /works/:id ============

  describe('GET /api/works/:id', () => {
    it('should return work detail', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Detail' })

      const res = await request(app).get(`/api/works/${createRes.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Detail')
      expect(res.body.contributors).toHaveLength(1)
    })

    it('should return 404 for non-existent work', async () => {
      const res = await request(app).get('/api/works/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  // ============ GET /works/:id/pages ============

  describe('GET /api/works/:id/pages', () => {
    it('should return pages for a work', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'With Pages',
          pages: [{ image_url: '/1.png' }, { image_url: '/2.png' }],
        })

      const res = await request(app).get(`/api/works/${createRes.body.id}/pages`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
    })
  })

  // ============ DELETE /works/:id ============

  describe('DELETE /api/works/:id', () => {
    it('should delete own work', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Delete Me' })

      const res = await request(app)
        .delete(`/api/works/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })

    it('should reject deleting others work', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Not Yours' })

      const res = await request(app)
        .delete(`/api/works/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token2}`)

      expect(res.status).toBe(403)
    })
  })

  // ============ POST /works/:id/fork ============

  describe('POST /api/works/:id/fork', () => {
    it('should fork a work', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Original',
          pages: [{ image_url: '/1.png' }, { image_url: '/2.png' }],
        })

      const res = await request(app)
        .post(`/api/works/${createRes.body.id}/fork`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ subtitle: '续写', fork_from_page: 1, pages: [{ image_url: '/new.png' }] })

      expect(res.status).toBe(201)
      expect(res.body.title).toBe('Original：续写')
      expect(res.body.id).toBeTruthy()
    })

    it('should reject forking without subtitle', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No Sub' })

      const res = await request(app)
        .post(`/api/works/${createRes.body.id}/fork`)
        .set('Authorization', `Bearer ${token2}`)
        .send({})

      expect(res.status).toBe(400)
    })
  })

  // ============ GET /works/:id/tree ============

  describe('GET /api/works/:id/tree', () => {
    it('should return creation tree', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Root', pages: [{ image_url: '/1.png' }] })
      expect(createRes.status).toBe(201)

      await request(app)
        .post(`/api/works/${createRes.body.id}/fork`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ subtitle: 'Branch' })

      const res = await request(app).get(`/api/works/${createRes.body.id}/tree`)

      expect(res.status).toBe(200)
      expect(res.body.works).toHaveLength(2)
    })
  })

  // ============ GET /works/:id/branches ============

  describe('GET /api/works/:id/branches', () => {
    it('should return branches at a page', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Parent', pages: [{ image_url: '/1.png' }, { image_url: '/2.png' }] })

      await request(app)
        .post(`/api/works/${createRes.body.id}/fork`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ subtitle: 'From 2', fork_from_page: 2 })

      const res = await request(app)
        .get(`/api/works/${createRes.body.id}/branches`)
        .query({ page: 2 })

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })

    it('should reject without page param', async () => {
      const createRes = await request(app)
        .post('/api/works')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Parent' })

      const res = await request(app).get(`/api/works/${createRes.body.id}/branches`)

      expect(res.status).toBe(400)
    })
  })
})
