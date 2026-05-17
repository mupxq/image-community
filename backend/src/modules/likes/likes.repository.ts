import { eq, and, sql, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { workLikes, pageLikes, workPages } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class LikesRepository {
  constructor(private db: Db) {}

  // Work likes
  async likeWork(workId: string, userId: string) {
    const [row] = await this.db.insert(workLikes).values({ workId, userId }).returning()
    return row
  }

  async unlikeWork(workId: string, userId: string) {
    const result = await this.db.delete(workLikes)
      .where(and(eq(workLikes.workId, workId), eq(workLikes.userId, userId)))
      .returning()
    return result.length > 0
  }

  async isWorkLiked(workId: string, userId: string) {
    const [row] = await this.db.select().from(workLikes)
      .where(and(eq(workLikes.workId, workId), eq(workLikes.userId, userId)))
    return !!row
  }

  async countWorkLikes(workId: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` })
      .from(workLikes).where(eq(workLikes.workId, workId))
    return Number(row.count)
  }

  // Page likes
  async likePage(pageId: string, userId: string) {
    const [row] = await this.db.insert(pageLikes).values({ pageId, userId }).returning()
    return row
  }

  async unlikePage(pageId: string, userId: string) {
    const result = await this.db.delete(pageLikes)
      .where(and(eq(pageLikes.pageId, pageId), eq(pageLikes.userId, userId)))
      .returning()
    return result.length > 0
  }

  async countPageLikes(pageId: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` })
      .from(pageLikes).where(eq(pageLikes.pageId, pageId))
    return Number(row.count)
  }

  async getPageLikeStatuses(workId: string, userId: string) {
    const pages = await this.db.select({ id: workPages.id, pageNumber: workPages.pageNumber })
      .from(workPages).where(eq(workPages.workId, workId)).orderBy(asc(workPages.pageNumber))

    const result = []
    for (const p of pages) {
      const likeCount = await this.countPageLikes(p.id)
      const liked = userId ? await this.isPageLikedInternal(p.id, userId) : false
      result.push({ pageId: p.id, pageNumber: p.pageNumber, likeCount, liked })
    }
    return result
  }

  private async isPageLikedInternal(pageId: string, userId: string) {
    const [row] = await this.db.select().from(pageLikes)
      .where(and(eq(pageLikes.pageId, pageId), eq(pageLikes.userId, userId)))
    return !!row
  }
}
