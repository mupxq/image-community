import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { AuthService } from '../../modules/auth/auth.service'
import { createAuthRouter } from '../../modules/auth/auth.routes'
import { errorHandler } from '../../middleware/errorHandler'
import { optionalAuth, requireAuth } from '../../middleware/auth'

function createApp(testDb: TestDb) {
  const app = express()
  app.use(express.json())

  const usersRepo = new UsersRepository(testDb.db)
  const authService = new AuthService(usersRepo)
  const authRouter = createAuthRouter(authService)

  app.use('/api/auth', authRouter)

  app.get('/api/me', optionalAuth, requireAuth, (req: any, res) => {
    res.json({ userId: req.userId })
  })

  app.use(errorHandler)
  return app
}

describe('Auth Routes', () => {
  let app: express.Express
  let testDb: TestDb

  beforeAll(async () => {
    testDb = await createTestDb()
    app = createApp(testDb)
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
  })

  describe('POST /api/auth/register', () => {
    it('should register and return 201 with token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123', nickname: 'Test' })

      expect(res.status).toBe(201)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user.username).toBe('testuser')
      expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    it('should reject missing fields with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'test' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBeTruthy()
    })

    it('should reject short username with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', password: 'password123', nickname: 'Test' })

      expect(res.status).toBe(400)
    })

    it('should reject short password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '12345', nickname: 'Test' })

      expect(res.status).toBe(400)
    })

    it('should reject duplicate username with 409', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'dup', password: 'password123', nickname: 'First' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'dup', password: 'password456', nickname: 'Second' })

      expect(res.status).toBe(409)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login and return token', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'loginuser', password: 'password123', nickname: 'Login' })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'password123' })

      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user.username).toBe('loginuser')
    })

    it('should reject non-existent user with 404', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ghost', password: 'password123' })

      expect(res.status).toBe(404)
    })

    it('should reject wrong password with 401', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'wrongpw', password: 'correct', nickname: 'Wrong' })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'wrongpw', password: 'incorrect' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'meuser', password: 'password123', nickname: 'Me' })

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      expect(res.status).toBe(200)
      expect(res.body.username).toBe('meuser')
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')

      expect(res.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
    })
  })

  describe('requireAuth middleware', () => {
    it('should allow access with valid token', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'authuser', password: 'password123', nickname: 'Auth' })

      const res = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${registerRes.body.token}`)

      expect(res.status).toBe(200)
      expect(res.body.userId).toBeTruthy()
    })

    it('should block access without token', async () => {
      const res = await request(app)
        .get('/api/me')

      expect(res.status).toBe(401)
    })
  })
})
