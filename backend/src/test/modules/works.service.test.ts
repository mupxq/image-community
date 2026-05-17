import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { WorksRepository } from '../../modules/works/works.repository'
import { WorkPagesRepository } from '../../modules/works/workPages.repository'
import { ContributorsRepository } from '../../modules/works/contributors.repository'
import { WorksService } from '../../modules/works/works.service'

describe('WorksService', () => {
  let testDb: TestDb
  let service: WorksService
  let userId: string
  let user2Id: string

  beforeAll(async () => {
    testDb = await createTestDb()
    const usersRepo = new UsersRepository(testDb.db)
    const worksRepo = new WorksRepository(testDb.db)
    const pagesRepo = new WorkPagesRepository(testDb.db)
    const contributorsRepo = new ContributorsRepository(testDb.db)
    service = new WorksService(worksRepo, pagesRepo, contributorsRepo)
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
    const usersRepo = new UsersRepository(testDb.db)
    const user = await usersRepo.create({ username: 'creator', passwordHash: 'x', nickname: 'Creator' })
    const user2 = await usersRepo.create({ username: 'forker', passwordHash: 'x', nickname: 'Forker' })
    userId = user.id
    user2Id = user2.id
  })

  // ============ createWork ============

  describe('createWork', () => {
    it('should create a work with pages and set root_work_id', async () => {
      const work = await service.createWork(userId, {
        title: 'My Comic',
        type: 'comic',
        pages: [
          { image_url: '/p1.png', description: 'Page 1' },
          { image_url: '/p2.png', description: 'Page 2' },
        ],
      })

      expect(work.title).toBe('My Comic')
      expect(work.rootWorkId).toBe(work.id)
      expect(work.status).toBe('published')
      expect(work.creatorId).toBe(userId)
    })

    it('should create pages in correct order', async () => {
      const work = await service.createWork(userId, {
        title: 'Pages Test',
        pages: [
          { image_url: '/1.png' },
          { image_url: '/2.png' },
          { image_url: '/3.png' },
        ],
      })

      const pages = await service.getPages(work.id)
      expect(pages).toHaveLength(3)
      expect(pages[0].pageNumber).toBe(1)
      expect(pages[2].pageNumber).toBe(3)
    })

    it('should add creator as contributor', async () => {
      const work = await service.createWork(userId, { title: 'Contrib Check' })
      const contributors = await service.getContributors(work.id)

      expect(contributors).toHaveLength(1)
      expect(contributors[0].userId).toBe(userId)
      expect(contributors[0].role).toBe('creator')
    })
  })

  // ============ getWork ============

  describe('getWork', () => {
    it('should return work with extra info', async () => {
      const created = await service.createWork(userId, { title: 'Detail Test', type: 'comic' })
      const work = await service.getWork(created.id)

      expect(work).toBeTruthy()
      expect(work!.title).toBe('Detail Test')
      expect(work!.contributors).toHaveLength(1)
    })

    it('should return undefined for non-existent work', async () => {
      const work = await service.getWork('00000000-0000-0000-0000-000000000000')
      expect(work).toBeUndefined()
    })
  })

  // ============ deleteWork ============

  describe('deleteWork', () => {
    it('should soft delete own work', async () => {
      const work = await service.createWork(userId, { title: 'To Delete' })
      await service.deleteWork(userId, work.id)

      const found = await service.getWork(work.id)
      // soft deleted works should not be returned by getWork
      expect(found).toBeUndefined()
    })

    it('should reject deleting others work', async () => {
      const work = await service.createWork(userId, { title: 'Not Yours' })

      await expect(service.deleteWork(user2Id, work.id))
        .rejects.toThrow('只能删除自己的作品')
    })

    it('should reject deleting non-existent work', async () => {
      await expect(service.deleteWork(userId, '00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('作品不存在')
    })
  })

  // ============ forkWork ============

  describe('forkWork', () => {
    it('should fork a work with subtitle', async () => {
      const parent = await service.createWork(userId, {
        title: 'Original',
        pages: [
          { image_url: '/1.png' },
          { image_url: '/2.png' },
        ],
      })

      const forked = await service.forkWork(user2Id, parent.id, {
        subtitle: '续集',
        fork_from_page: 1,
        pages: [{ image_url: '/new.png' }],
      })

      expect(forked.title).toBe('Original：续集')
      expect(forked.parentWorkId).toBe(parent.id)
      expect(forked.rootWorkId).toBe(parent.rootWorkId)
      expect(forked.creatorId).toBe(user2Id)
      expect(forked.forkFromPage).toBe(1)
    })

    it('should copy parent pages up to fork_from_page', async () => {
      const parent = await service.createWork(userId, {
        title: 'Parent',
        pages: [
          { image_url: '/p1.png' },
          { image_url: '/p2.png' },
          { image_url: '/p3.png' },
        ],
      })

      const forked = await service.forkWork(user2Id, parent.id, {
        subtitle: 'Fork',
        fork_from_page: 2,
        pages: [{ image_url: '/new.png' }],
      })

      const pages = await service.getPages(forked.id)
      // 2 copied + 1 new = 3
      expect(pages).toHaveLength(3)
      expect(pages[0].imageUrl).toBe('/p1.png')
      expect(pages[1].imageUrl).toBe('/p2.png')
      expect(pages[2].pageNumber).toBe(3)
      expect(pages[2].imageUrl).toBe('/new.png')
    })

    it('should inherit parent contributors as ancestors', async () => {
      const parent = await service.createWork(userId, { title: 'Ancestor Test' })

      const forked = await service.forkWork(user2Id, parent.id, {
        subtitle: 'Forked',
      })

      const contributors = await service.getContributors(forked.id)
      const roles = contributors.map(c => c.role)

      expect(roles).toContain('creator')   // user2 as creator
      expect(roles).toContain('ancestor')   // user1 as ancestor
    })

    it('should reject forking non-allow_fork work', async () => {
      const parent = await service.createWork(userId, {
        title: 'No Fork',
        allow_fork: false,
      })

      await expect(service.forkWork(user2Id, parent.id, { subtitle: 'Try' }))
        .rejects.toThrow('该作品不允许共创')
    })

    it('should reject forking non-existent work', async () => {
      await expect(service.forkWork(user2Id, '00000000-0000-0000-0000-000000000000', { subtitle: 'Ghost' }))
        .rejects.toThrow('原作品不存在')
    })
  })

  // ============ getTree ============

  describe('getTree', () => {
    it('should return all works in a creation tree', async () => {
      const root = await service.createWork(userId, {
        title: 'Root',
        pages: [{ image_url: '/r1.png' }],
      })

      await service.forkWork(user2Id, root.id, {
        subtitle: 'Branch',
        pages: [{ image_url: '/b1.png' }],
      })

      const tree = await service.getTree(root.id)

      expect(tree.works).toHaveLength(2)
      expect(tree.rootWorkId).toBe(root.id)
    })

    it('should reject non-existent root', async () => {
      await expect(service.getTree('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('作品不存在')
    })
  })

  // ============ listWorks ============

  describe('listWorks', () => {
    it('should return only published works', async () => {
      await service.createWork(userId, { title: 'Published', status: 'published' as any })
      await service.createWork(userId, { title: 'Draft' })

      const works = await service.listWorks()
      expect(works.every(w => w.status === 'published')).toBe(true)
    })

    it('should filter by type', async () => {
      await service.createWork(userId, { title: 'Comic', type: 'comic', status: 'published' as any })
      await service.createWork(userId, { title: 'Drama', type: 'drama', status: 'published' as any })

      const comics = await service.listWorks({ type: 'comic' })
      expect(comics).toHaveLength(1)
      expect(comics[0].type).toBe('comic')
    })
  })

  // ============ getBranches ============

  describe('getBranches', () => {
    it('should return branches at a specific page', async () => {
      const parent = await service.createWork(userId, {
        title: 'Parent',
        pages: [{ image_url: '/1.png' }, { image_url: '/2.png' }, { image_url: '/3.png' }],
      })

      await service.forkWork(user2Id, parent.id, {
        subtitle: 'From Page 2',
        fork_from_page: 2,
      })

      const branches = await service.getBranches(parent.id, 2)
      expect(branches).toHaveLength(1)

      const emptyBranches = await service.getBranches(parent.id, 1)
      expect(emptyBranches).toHaveLength(0)
    })
  })
})
