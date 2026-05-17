import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { WorksRepository } from '../../modules/works/works.repository'
import { WorkPagesRepository } from '../../modules/works/workPages.repository'
import { ContributorsRepository } from '../../modules/works/contributors.repository'
import { BookmarksRepository } from '../../modules/bookmarks/bookmarks.repository'
import { BookmarksService } from '../../modules/bookmarks/bookmarks.service'

describe('Bookmarks', () => {
  let testDb: TestDb
  let repo: BookmarksRepository
  let service: BookmarksService
  let userId: string
  let workId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    const usersRepo = new UsersRepository(testDb.db)
    const worksRepo = new WorksRepository(testDb.db)
    const pagesRepo = new WorkPagesRepository(testDb.db)
    const contribRepo = new ContributorsRepository(testDb.db)

    const u = await usersRepo.create({ username: 'reader', passwordHash: 'x', nickname: 'Reader' })
    userId = u.id

    const w = await worksRepo.create({ title: 'Book', type: 'comic', creatorId: userId, status: 'published' })
    await worksRepo.update(w.id, { rootWorkId: w.id })
    await contribRepo.create({ workId: w.id, userId, role: 'creator' })
    await pagesRepo.create({ workId: w.id, pageNumber: 1, imageUrl: '/1.png' })
    await pagesRepo.create({ workId: w.id, pageNumber: 2, imageUrl: '/2.png' })
    workId = w.id

    repo = new BookmarksRepository(testDb.db)
    service = new BookmarksService(repo)
  })

  afterAll(async () => { await testDb.teardown() })

  beforeEach(async () => {
    const { bookmarks } = await import('../../db/schema')
    await testDb.db.delete(bookmarks)
  })

  describe('Repository', () => {
    it('should create a bookmark', async () => {
      const bm = await repo.create({ userId, workId })
      expect(bm.workId).toBe(workId)
      expect(bm.readStatus).toBe('want_read')
    })

    it('should find bookmark by user and work', async () => {
      await repo.create({ userId, workId })
      const found = await repo.findByUserAndWork(userId, workId)
      expect(found).toBeTruthy()
    })

    it('should list bookmarks by user', async () => {
      await repo.create({ userId, workId })
      const list = await repo.findByUserId(userId)
      expect(list).toHaveLength(1)
    })

    it('should update bookmark', async () => {
      const bm = await repo.create({ userId, workId })
      const updated = await repo.update(bm.id, { readStatus: 'reading', lastReadPage: 1 })
      expect(updated!.readStatus).toBe('reading')
      expect(updated!.lastReadPage).toBe(1)
    })

    it('should delete bookmark', async () => {
      const bm = await repo.create({ userId, workId })
      const deleted = await repo.delete(bm.id, userId)
      expect(deleted).toBe(true)
    })

    it('should reject deleting others bookmark', async () => {
      const bm = await repo.create({ userId, workId })
      const deleted = await repo.delete(bm.id, '00000000-0000-0000-0000-000000000000')
      expect(deleted).toBe(false)
    })
  })

  describe('Service', () => {
    it('should add to bookshelf', async () => {
      const bm = await service.addBookmark(userId, workId)
      expect(bm.readStatus).toBe('want_read')
    })

    it('should reject duplicate bookmark', async () => {
      await service.addBookmark(userId, workId)
      await expect(service.addBookmark(userId, workId)).rejects.toThrow()
    })

    it('should update reading progress', async () => {
      await service.addBookmark(userId, workId)
      const updated = await service.updateBookmark(userId, workId, { readStatus: 'reading', lastReadPage: 2 })
      expect(updated!.readStatus).toBe('reading')
    })

    it('should remove from bookshelf', async () => {
      await service.addBookmark(userId, workId)
      await service.removeBookmark(userId, workId)
      const found = await service.checkBookmark(userId, workId)
      expect(found.bookmarked).toBe(false)
    })

    it('should check bookmark status', async () => {
      await service.addBookmark(userId, workId)
      const status = await service.checkBookmark(userId, workId)
      expect(status.bookmarked).toBe(true)
    })
  })
})
