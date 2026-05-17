import { eq, and, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { bookmarks, works, users, workPages } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class BookmarksRepository {
  constructor(private db: Db) {}

  async create(data: { userId: string; workId: string }) {
    const [row] = await this.db.insert(bookmarks).values({
      userId: data.userId,
      workId: data.workId,
      readStatus: 'want_read',
    }).returning()
    return row
  }

  async findByUserAndWork(userId: string, workId: string) {
    const [row] = await this.db.select().from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.workId, workId)))
    return row ?? undefined
  }

  async findByUserId(userId: string, status?: string) {
    const conditions = [eq(bookmarks.userId, userId)]
    if (status && status !== 'all') {
      conditions.push(eq(bookmarks.readStatus, status as any))
    }
    return this.db.select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      workId: bookmarks.workId,
      readStatus: bookmarks.readStatus,
      lastReadPage: bookmarks.lastReadPage,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt,
      title: works.title,
      description: works.description,
      type: works.type,
      coverImage: works.coverImage,
      creatorName: users.nickname,
      creatorAvatar: users.avatar,
      totalPages: sql<number>`(SELECT count(*) FROM work_pages WHERE work_id = ${works.id})`,
    })
      .from(bookmarks)
      .innerJoin(works, eq(bookmarks.workId, works.id))
      .innerJoin(users, eq(works.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(bookmarks.updatedAt))
  }

  async update(id: string, data: { readStatus?: string; lastReadPage?: number }) {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() }
    const [updated] = await this.db.update(bookmarks).set(updateData)
      .where(eq(bookmarks.id, id)).returning()
    return updated ?? undefined
  }

  async delete(id: string, userId: string) {
    const result = await this.db.delete(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .returning()
    return result.length > 0
  }
}
