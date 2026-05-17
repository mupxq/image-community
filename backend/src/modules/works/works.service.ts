import { NotFoundError, ForbiddenError } from '../../shared/errors'
import type { WorksRepository } from './works.repository'
import type { WorkPagesRepository } from './workPages.repository'
import type { ContributorsRepository } from './contributors.repository'
import type { CreateWorkInput, ForkWorkInput } from './works.schema'

export class WorksService {
  constructor(
    private worksRepo: WorksRepository,
    private pagesRepo: WorkPagesRepository,
    private contributorsRepo: ContributorsRepository,
  ) {}

  async createWork(userId: string, input: CreateWorkInput & { status?: string }) {
    const work = await this.worksRepo.create({
      title: input.title,
      type: input.type ?? 'comic',
      creatorId: userId,
      description: input.description,
      coverImage: input.cover_image,
      allowFork: input.allow_fork,
      status: 'published',
    })

    // Set root_work_id to self
    await this.worksRepo.update(work.id, { rootWorkId: work.id })

    // Add creator as contributor
    await this.contributorsRepo.create({ workId: work.id, userId, role: 'creator' })

    // Create pages
    if (input.pages && input.pages.length > 0) {
      await this.pagesRepo.createMany(work.id, input.pages.map((p, i) => ({
        pageNumber: i + 1,
        imageUrl: p.image_url,
        description: p.description,
        dialogue: p.dialogue,
        aiGenerated: p.ai_generated,
      })))
    }

    // Return with updated rootWorkId
    const updated = await this.worksRepo.findById(work.id)
    return updated!
  }

  async getWork(id: string) {
    const work = await this.worksRepo.findById(id)
    if (!work || work.status === 'deleted') return undefined

    const contributors = await this.contributorsRepo.findByWorkId(work.id)
    return { ...work, contributors }
  }

  async getPages(workId: string) {
    return this.pagesRepo.findByWorkId(workId)
  }

  async getContributors(workId: string) {
    return this.contributorsRepo.findByWorkId(workId)
  }

  async deleteWork(userId: string, workId: string) {
    const work = await this.worksRepo.findById(workId)
    if (!work) throw new NotFoundError('作品不存在')
    if (work.creatorId !== userId) throw new ForbiddenError('只能删除自己的作品')

    await this.worksRepo.softDelete(workId)
  }

  async forkWork(userId: string, parentWorkId: string, input: ForkWorkInput) {
    const parent = await this.worksRepo.findById(parentWorkId)
    if (!parent) throw new NotFoundError('原作品不存在')
    if (!parent.allowFork) throw new ForbiddenError('该作品不允许共创')

    const title = `${parent.title}：${input.subtitle}`
    const rootId = parent.rootWorkId ?? parent.id

    const forked = await this.worksRepo.create({
      title,
      type: parent.type,
      creatorId: userId,
      description: input.description,
      coverImage: input.cover_image,
      parentWorkId: parent.id,
      rootWorkId: rootId,
      forkFromPage: input.fork_from_page ?? undefined,
      status: 'published',
    })

    // Add creator as contributor
    await this.contributorsRepo.create({ workId: forked.id, userId, role: 'creator' })

    // Inherit parent contributors as ancestors
    const parentContributorIds = await this.contributorsRepo.findUserIdsByWorkId(parent.id)
    const ancestorEntries = parentContributorIds
      .filter(id => id !== userId)
      .map(id => ({ workId: forked.id, userId: id, role: 'ancestor' as const }))
    if (ancestorEntries.length > 0) {
      await this.contributorsRepo.createMany(ancestorEntries)
    }

    // Copy parent pages up to fork_from_page
    let startPageNumber = 1
    if (input.fork_from_page && input.fork_from_page > 0) {
      const parentPages = await this.pagesRepo.findByWorkIdUpToPage(parent.id, input.fork_from_page)
      if (parentPages.length > 0) {
        await this.pagesRepo.createMany(forked.id, parentPages.map(p => ({
          pageNumber: p.pageNumber,
          imageUrl: p.imageUrl ?? undefined,
          description: p.description ?? undefined,
          dialogue: p.dialogue ?? undefined,
          aiGenerated: p.aiGenerated,
        })))
      }
      startPageNumber = input.fork_from_page + 1
    }

    // Add new pages
    if (input.pages && input.pages.length > 0) {
      await this.pagesRepo.createMany(forked.id, input.pages.map((p, i) => ({
        pageNumber: startPageNumber + i,
        imageUrl: p.image_url,
        description: p.description,
        dialogue: p.dialogue,
        aiGenerated: p.ai_generated,
      })))
    }

    return forked
  }

  async getTree(workId: string) {
    const work = await this.worksRepo.findById(workId)
    if (!work) throw new NotFoundError('作品不存在')

    const rootId = work.rootWorkId ?? work.id
    const treeWorks = await this.worksRepo.findByRootId(rootId)

    return { works: treeWorks, rootWorkId: rootId }
  }

  async listWorks(opts?: { type?: string; sort?: string }) {
    return this.worksRepo.findPublished(opts)
  }

  async getBranches(workId: string, page: number) {
    return this.worksRepo.findBranches(workId, page)
  }
}
