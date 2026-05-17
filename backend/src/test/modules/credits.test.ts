import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { CreditsRepository } from '../../modules/credits/credits.repository'
import { CreditsService } from '../../modules/credits/credits.service'

describe('Credits', () => {
  let testDb: TestDb
  let repo: CreditsRepository
  let service: CreditsService
  let userId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    const usersRepo = new UsersRepository(testDb.db)
    const u = await usersRepo.create({ username: 'creditor', passwordHash: 'x', nickname: 'Creditor' })
    userId = u.id
    repo = new CreditsRepository(testDb.db)
    service = new CreditsService(repo, usersRepo)
  })

  afterAll(async () => { await testDb.teardown() })

  beforeEach(async () => {
    const { creditLogs, checkIns } = await import('../../db/schema')
    await testDb.db.delete(creditLogs)
    await testDb.db.delete(checkIns)
    // Reset credits
    const usersRepo = new UsersRepository(testDb.db)
    await usersRepo.updateCredits(userId, 1000)
  })

  describe('Repository', () => {
    it('should create a check-in', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const ci = await repo.createCheckIn({ userId, checkDate: today, streak: 1, creditsEarned: 100 })
      expect(ci.streak).toBe(1)
      expect(ci.creditsEarned).toBe(100)
    })

    it('should reject duplicate check-in', async () => {
      const today = new Date().toISOString().slice(0, 10)
      await repo.createCheckIn({ userId, checkDate: today, streak: 1, creditsEarned: 100 })
      await expect(repo.createCheckIn({ userId, checkDate: today, streak: 2, creditsEarned: 100 }))
        .rejects.toThrow()
    })

    it('should get last check-in', async () => {
      const today = new Date().toISOString().slice(0, 10)
      await repo.createCheckIn({ userId, checkDate: today, streak: 1, creditsEarned: 100 })
      const last = await repo.getLastCheckIn(userId)
      expect(last).toBeTruthy()
      expect(last!.streak).toBe(1)
    })

    it('should create credit log', async () => {
      const log = await repo.createLog({ userId, amount: 100, type: 'check_in', description: '每日签到' })
      expect(log.amount).toBe(100)
      expect(log.type).toBe('check_in')
    })

    it('should get credit logs', async () => {
      await repo.createLog({ userId, amount: 100, type: 'check_in', description: '签到' })
      await repo.createLog({ userId, amount: -50, type: 'ai_generate', description: '生成' })
      const logs = await repo.getLogs(userId)
      expect(logs).toHaveLength(2)
    })
  })

  describe('Service', () => {
    it('should check in and earn 100 credits', async () => {
      const result = await service.checkIn(userId)
      expect(result.creditsEarned).toBe(100)
      expect(result.streak).toBe(1)
    })

    it('should reject duplicate check-in', async () => {
      await service.checkIn(userId)
      await expect(service.checkIn(userId)).rejects.toThrow('今日已签到')
    })

    it('should give 500 credits on 7th consecutive day', async () => {
      // Simulate 6 previous check-ins
      const repo2 = new CreditsRepository(testDb.db)
      for (let i = 6; i >= 1; i--) {
        const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
        await repo2.createCheckIn({ userId, checkDate: date, streak: 7 - i, creditsEarned: 100 })
      }
      // 7th day = today
      const result = await service.checkIn(userId)
      expect(result.streak).toBe(7)
      expect(result.creditsEarned).toBe(500)
    })

    it('should get credits status', async () => {
      const status = await service.getStatus(userId)
      expect(status.credits).toBe(1000)
      expect(status.checkedInToday).toBe(false)
    })

    it('should show checkedInToday after check-in', async () => {
      await service.checkIn(userId)
      const status = await service.getStatus(userId)
      expect(status.checkedInToday).toBe(true)
    })
  })
})
