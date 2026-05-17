import { eq, and, isNull, sql, desc, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { works, workTypeEnum, workStatusEnum } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class WorksRepository {
  constructor(private db: Db) {}

  async create(data: {
    title: string
    type: string
    creatorId: string
    description?: string
    coverImage?: string
    parentWorkId?: string
    rootWorkId?: string
    forkFromPage?: number
    allowFork?: boolean
    status?: string
  }) {
    const [work] = await this.db.insert(works).values({
      title: data.title,
      type: data.type as typeof workTypeEnum.enumValues[number],
      creatorId: data.creatorId,
      description: data.description ?? '',
      coverImage: data.coverImage ?? '',
      parentWorkId: data.parentWorkId ?? null,
      rootWorkId: data.rootWorkId ?? null,
      forkFromPage: data.forkFromPage ?? null,
      allowFork: data.allowFork ?? true,
      status: (data.status ?? 'draft') as typeof workStatusEnum.enumValues[number],
    }).returning()
    return work
  }

  async findById(id: string) {
    const [work] = await this.db.select().from(works).where(eq(works.id, id))
    return work ?? undefined
  }

  async update(id: string, data: {
    title?: string
    description?: string
    coverImage?: string
    status?: string
    rootWorkId?: string
    allowFork?: boolean
  }) {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() }
    if (data.status) updateData.status = data.status
    const [updated] = await this.db.update(works).set(updateData).where(eq(works.id, id)).returning()
    return updated ?? undefined
  }

  async softDelete(id: string) {
    const [updated] = await this.db.update(works).set({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(works.id, id)).returning()
    return updated ?? undefined
  }

  async findPublished(opts?: { type?: string; sort?: string }) {
    let query = this.db.select().from(works).where(eq(works.status, 'published'))

    const conditions = [eq(works.status, 'published')]
    if (opts?.type) {
      conditions.push(eq(works.type, opts.type as typeof workTypeEnum.enumValues[number]))
    }

    const orderBy = opts?.sort === 'oldest'
      ? asc(works.createdAt)
      : desc(works.createdAt)

    return this.db.select().from(works)
      .where(and(...conditions))
      .orderBy(orderBy)
  }

  async findByCreator(creatorId: string) {
    return this.db.select().from(works)
      .where(and(eq(works.creatorId, creatorId), eq(works.status, 'published')))
      .orderBy(desc(works.createdAt))
  }

  async findByRootId(rootId: string) {
    return this.db.select().from(works)
      .where(
        and(
          sql`(${works.rootWorkId} = ${rootId} OR ${works.id} = ${rootId})`,
          eq(works.status, 'published'),
        )
      )
      .orderBy(asc(works.createdAt))
  }

  async findBranches(parentWorkId: string, forkFromPage: number) {
    return this.db.select().from(works)
      .where(
        and(
          eq(works.parentWorkId, parentWorkId),
          eq(works.forkFromPage, forkFromPage),
          eq(works.status, 'published'),
        )
      )
      .orderBy(desc(works.createdAt))
  }

  async countByParentWorkId(parentWorkId: string) {
    const [result] = await this.db.select({ count: sql<number>`count(*)` })
      .from(works)
      .where(eq(works.parentWorkId, parentWorkId))
    return Number(result.count)
  }
}
