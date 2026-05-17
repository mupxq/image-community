import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'

describe('UsersRepository', () => {
  let repo: UsersRepository
  let testDb: TestDb

  beforeAll(async () => {
    testDb = await createTestDb()
    repo = new UsersRepository(testDb.db)
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
  })

  describe('create', () => {
    it('should create a user and return it with UUID id', async () => {
      const user = await repo.create({
        username: 'testuser',
        passwordHash: 'hashed',
        nickname: 'Test',
      })

      expect(user.id).toBeTruthy()
      expect(typeof user.id).toBe('string')
      expect(user.username).toBe('testuser')
      expect(user.nickname).toBe('Test')
      expect(user.credits).toBe(1000)
      expect(user.status).toBe('active')
    })
  })

  describe('findById', () => {
    it('should find a user by id', async () => {
      const created = await repo.create({
        username: 'findme',
        passwordHash: 'hashed',
        nickname: 'Find Me',
      })

      const found = await repo.findById(created.id)

      expect(found).toBeTruthy()
      expect(found!.id).toBe(created.id)
      expect(found!.username).toBe('findme')
    })

    it('should return undefined for non-existent id', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000')
      expect(found).toBeUndefined()
    })
  })

  describe('findByUsername', () => {
    it('should find a user by username', async () => {
      await repo.create({
        username: 'uniqueuser',
        passwordHash: 'hashed',
        nickname: 'Unique',
      })

      const found = await repo.findByUsername('uniqueuser')

      expect(found).toBeTruthy()
      expect(found!.username).toBe('uniqueuser')
    })

    it('should return undefined for non-existent username', async () => {
      const found = await repo.findByUsername('ghost')
      expect(found).toBeUndefined()
    })
  })

  describe('updateProfile', () => {
    it('should update nickname and bio', async () => {
      const created = await repo.create({
        username: 'updateme',
        passwordHash: 'hashed',
        nickname: 'Old Name',
      })

      const updated = await repo.updateProfile(created.id, {
        nickname: 'New Name',
        bio: 'Hello world',
      })

      expect(updated).toBeTruthy()
      expect(updated!.nickname).toBe('New Name')
      expect(updated!.bio).toBe('Hello world')
    })
  })

  describe('updateCredits', () => {
    it('should update user credits', async () => {
      const created = await repo.create({
        username: 'creditsuser',
        passwordHash: 'hashed',
        nickname: 'Credits',
      })

      const updated = await repo.updateCredits(created.id, 2000)

      expect(updated).toBeTruthy()
      expect(updated!.credits).toBe(2000)
    })
  })
})
