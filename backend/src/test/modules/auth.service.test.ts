import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { AuthService } from '../../modules/auth/auth.service'

describe('AuthService', () => {
  let service: AuthService
  let testDb: TestDb

  beforeAll(async () => {
    testDb = await createTestDb()
    const usersRepo = new UsersRepository(testDb.db)
    service = new AuthService(usersRepo)
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
  })

  describe('register', () => {
    it('should register a new user and return token + user', async () => {
      const result = await service.register({
        username: 'newuser',
        password: 'password123',
        nickname: 'New User',
      })

      expect(result.token).toBeTruthy()
      expect(typeof result.token).toBe('string')
      expect(result.user.username).toBe('newuser')
      expect(result.user.nickname).toBe('New User')
      expect(result.user).not.toHaveProperty('passwordHash')
    })

    it('should reject duplicate username', async () => {
      await service.register({
        username: 'duplicate',
        password: 'password123',
        nickname: 'First',
      })

      await expect(
        service.register({
          username: 'duplicate',
          password: 'password456',
          nickname: 'Second',
        })
      ).rejects.toThrow('用户名已被使用')
    })

    it('should hash the password', async () => {
      await service.register({
        username: 'hashtest',
        password: 'mypassword',
        nickname: 'Hash',
      })

      const user = await service['usersRepo'].findByUsername('hashtest')
      expect(user!.passwordHash).not.toBe('mypassword')
    })
  })

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await service.register({
        username: 'loginuser',
        password: 'password123',
        nickname: 'Login',
      })

      const result = await service.login({
        username: 'loginuser',
        password: 'password123',
      })

      expect(result.token).toBeTruthy()
      expect(result.user.username).toBe('loginuser')
      expect(result.user).not.toHaveProperty('passwordHash')
    })

    it('should reject non-existent user', async () => {
      await expect(
        service.login({
          username: 'ghost',
          password: 'password123',
        })
      ).rejects.toThrow('该账号未注册')
    })

    it('should reject wrong password', async () => {
      await service.register({
        username: 'wrongpw',
        password: 'correct',
        nickname: 'Wrong PW',
      })

      await expect(
        service.login({
          username: 'wrongpw',
          password: 'incorrect',
        })
      ).rejects.toThrow('密码错误')
    })
  })

  describe('verifyToken', () => {
    it('should extract userId from valid token', async () => {
      const { token, user } = await service.register({
        username: 'tokenuser',
        password: 'password123',
        nickname: 'Token',
      })

      const userId = service.verifyToken(token)
      expect(userId).toBe(user.id)
    })

    it('should throw on invalid token', () => {
      expect(() => service.verifyToken('invalid-token')).toThrow()
    })
  })

  describe('getMe', () => {
    it('should return user without password hash', async () => {
      const { user } = await service.register({
        username: 'meuser',
        password: 'password123',
        nickname: 'Me',
      })

      const result = await service.getMe(user.id)

      expect(result).toBeTruthy()
      expect(result!.id).toBe(user.id)
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('should return undefined for non-existent user', async () => {
      const result = await service.getMe('00000000-0000-0000-0000-000000000000')
      expect(result).toBeUndefined()
    })
  })
})
