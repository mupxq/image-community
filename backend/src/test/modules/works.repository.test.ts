import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { WorksRepository } from '../../modules/works/works.repository'
import { WorkPagesRepository } from '../../modules/works/workPages.repository'
import { ContributorsRepository } from '../../modules/works/contributors.repository'

describe('Works Repositories', () => {
  let testDb: TestDb
  let usersRepo: UsersRepository
  let worksRepo: WorksRepository
  let pagesRepo: WorkPagesRepository
  let contributorsRepo: ContributorsRepository
  let userId: string

  beforeAll(async () => {
    testDb = await createTestDb()
    usersRepo = new UsersRepository(testDb.db)
    worksRepo = new WorksRepository(testDb.db)
    pagesRepo = new WorkPagesRepository(testDb.db)
    contributorsRepo = new ContributorsRepository(testDb.db)
  })

  afterAll(async () => {
    await testDb.teardown()
  })

  beforeEach(async () => {
    await testDb.cleanup()
    const user = await usersRepo.create({ username: 'creator', passwordHash: 'x', nickname: 'Creator' })
    userId = user.id
  })

  // ============ WorksRepository ============

  describe('WorksRepository', () => {
    it('should create a work', async () => {
      const work = await worksRepo.create({
        title: 'Test Comic',
        type: 'comic',
        creatorId: userId,
      })

      expect(work.id).toBeTruthy()
      expect(work.title).toBe('Test Comic')
      expect(work.creatorId).toBe(userId)
      expect(work.status).toBe('draft')
      expect(work.rootWorkId).toBeNull()
    })

    it('should find work by id', async () => {
      const created = await worksRepo.create({ title: 'Find Me', type: 'comic', creatorId: userId })
      const found = await worksRepo.findById(created.id)

      expect(found).toBeTruthy()
      expect(found!.title).toBe('Find Me')
    })

    it('should return undefined for non-existent id', async () => {
      const found = await worksRepo.findById('00000000-0000-0000-0000-000000000000')
      expect(found).toBeUndefined()
    })

    it('should update work root_work_id', async () => {
      const created = await worksRepo.create({ title: 'Root Test', type: 'comic', creatorId: userId })
      const updated = await worksRepo.update(created.id, { rootWorkId: created.id })

      expect(updated!.rootWorkId).toBe(created.id)
    })

    it('should soft delete a work', async () => {
      const created = await worksRepo.create({ title: 'Delete Me', type: 'comic', creatorId: userId })
      const deleted = await worksRepo.softDelete(created.id)

      expect(deleted!.status).toBe('deleted')
      expect(deleted!.deletedAt).toBeTruthy()
    })

    it('should list published works', async () => {
      await worksRepo.create({ title: 'Published', type: 'comic', creatorId: userId, status: 'published' })
      await worksRepo.create({ title: 'Draft', type: 'comic', creatorId: userId, status: 'draft' })

      const published = await worksRepo.findPublished()
      expect(published).toHaveLength(1)
      expect(published[0].title).toBe('Published')
    })

    it('should filter works by type', async () => {
      await worksRepo.create({ title: 'Comic', type: 'comic', creatorId: userId, status: 'published' })
      await worksRepo.create({ title: 'Drama', type: 'drama', creatorId: userId, status: 'published' })

      const comics = await worksRepo.findPublished({ type: 'comic' })
      expect(comics).toHaveLength(1)
      expect(comics[0].type).toBe('comic')
    })

    it('should find works by creator', async () => {
      await worksRepo.create({ title: 'My Work', type: 'comic', creatorId: userId, status: 'published' })
      const user2 = await usersRepo.create({ username: 'other', passwordHash: 'x', nickname: 'Other' })
      await worksRepo.create({ title: 'Other Work', type: 'comic', creatorId: user2.id, status: 'published' })

      const myWorks = await worksRepo.findByCreator(userId)
      expect(myWorks).toHaveLength(1)
      expect(myWorks[0].title).toBe('My Work')
    })

    it('should find works in a tree by root id', async () => {
      const root = await worksRepo.create({ title: 'Root', type: 'comic', creatorId: userId, status: 'published' })
      await worksRepo.update(root.id, { rootWorkId: root.id })

      const child = await worksRepo.create({
        title: 'Child', type: 'comic', creatorId: userId,
        parentWorkId: root.id, rootWorkId: root.id, status: 'published',
      })

      const treeWorks = await worksRepo.findByRootId(root.id)
      expect(treeWorks).toHaveLength(2)
    })

    it('should find branches by parent and page', async () => {
      const parent = await worksRepo.create({ title: 'Parent', type: 'comic', creatorId: userId, status: 'published' })
      await worksRepo.update(parent.id, { rootWorkId: parent.id })

      await worksRepo.create({
        title: 'Branch at page 3', type: 'comic', creatorId: userId,
        parentWorkId: parent.id, rootWorkId: parent.id, forkFromPage: 3, status: 'published',
      })

      const branches = await worksRepo.findBranches(parent.id, 3)
      expect(branches).toHaveLength(1)
      expect(branches[0].title).toBe('Branch at page 3')

      const noBranches = await worksRepo.findBranches(parent.id, 5)
      expect(noBranches).toHaveLength(0)
    })
  })

  // ============ WorkPagesRepository ============

  describe('WorkPagesRepository', () => {
    let workId: string

    beforeEach(async () => {
      const work = await worksRepo.create({ title: 'Page Test', type: 'comic', creatorId: userId })
      workId = work.id
    })

    it('should create pages', async () => {
      const page = await pagesRepo.create({
        workId,
        pageNumber: 1,
        imageUrl: '/img1.png',
        description: 'First page',
      })

      expect(page.id).toBeTruthy()
      expect(page.workId).toBe(workId)
      expect(page.pageNumber).toBe(1)
    })

    it('should create multiple pages at once', async () => {
      const pages = await pagesRepo.createMany(workId, [
        { pageNumber: 1, imageUrl: '/1.png' },
        { pageNumber: 2, imageUrl: '/2.png' },
        { pageNumber: 3, imageUrl: '/3.png' },
      ])

      expect(pages).toHaveLength(3)
      expect(pages[0].pageNumber).toBe(1)
      expect(pages[2].pageNumber).toBe(3)
    })

    it('should find pages by work id', async () => {
      await pagesRepo.create({ workId, pageNumber: 1, imageUrl: '/1.png' })
      await pagesRepo.create({ workId, pageNumber: 2, imageUrl: '/2.png' })

      const found = await pagesRepo.findByWorkId(workId)
      expect(found).toHaveLength(2)
      expect(found[0].pageNumber).toBe(1)
    })

    it('should count pages for a work', async () => {
      await pagesRepo.create({ workId, pageNumber: 1, imageUrl: '/1.png' })
      await pagesRepo.create({ workId, pageNumber: 2, imageUrl: '/2.png' })

      const count = await pagesRepo.countByWorkId(workId)
      expect(count).toBe(2)
    })

    it('should find pages up to a specific page number', async () => {
      await pagesRepo.create({ workId, pageNumber: 1, imageUrl: '/1.png' })
      await pagesRepo.create({ workId, pageNumber: 2, imageUrl: '/2.png' })
      await pagesRepo.create({ workId, pageNumber: 3, imageUrl: '/3.png' })

      const pages = await pagesRepo.findByWorkIdUpToPage(workId, 2)
      expect(pages).toHaveLength(2)
    })
  })

  // ============ ContributorsRepository ============

  describe('ContributorsRepository', () => {
    let workId: string

    beforeEach(async () => {
      const work = await worksRepo.create({ title: 'Contrib Test', type: 'comic', creatorId: userId })
      workId = work.id
    })

    it('should add a contributor', async () => {
      const contributor = await contributorsRepo.create({
        workId,
        userId,
        role: 'creator',
      })

      expect(contributor.workId).toBe(workId)
      expect(contributor.userId).toBe(userId)
      expect(contributor.role).toBe('creator')
    })

    it('should find contributors by work id', async () => {
      await contributorsRepo.create({ workId, userId, role: 'creator' })
      const user2 = await usersRepo.create({ username: 'helper', passwordHash: 'x', nickname: 'Helper' })
      await contributorsRepo.create({ workId, userId: user2.id, role: 'collaborator' })

      const found = await contributorsRepo.findByWorkId(workId)
      expect(found).toHaveLength(2)
    })

    it('should find distinct contributor user ids', async () => {
      await contributorsRepo.create({ workId, userId, role: 'creator' })

      const userIds = await contributorsRepo.findUserIdsByWorkId(workId)
      expect(userIds).toContain(userId)
    })

    it('should add contributors in batch', async () => {
      const user2 = await usersRepo.create({ username: 'ancestor1', passwordHash: 'x', nickname: 'Anc1' })
      const user3 = await usersRepo.create({ username: 'ancestor2', passwordHash: 'x', nickname: 'Anc2' })

      await contributorsRepo.createMany([
        { workId, userId, role: 'creator' as const },
        { workId, userId: user2.id, role: 'ancestor' as const },
        { workId, userId: user3.id, role: 'ancestor' as const },
      ])

      const found = await contributorsRepo.findByWorkId(workId)
      expect(found).toHaveLength(3)
    })
  })
})
