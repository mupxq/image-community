import { eq, lte, and, asc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { workPages } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class WorkPagesRepository {
  constructor(private db: Db) {}

  async create(data: {
    workId: string
    pageNumber: number
    imageUrl?: string
    description?: string
    dialogue?: string
    aiGenerated?: boolean
  }) {
    const [page] = await this.db.insert(workPages).values({
      workId: data.workId,
      pageNumber: data.pageNumber,
      imageUrl: data.imageUrl ?? '',
      description: data.description ?? '',
      dialogue: data.dialogue ?? '',
      aiGenerated: data.aiGenerated ?? false,
    }).returning()
    return page
  }

  async createMany(workId: string, pages: {
    pageNumber: number
    imageUrl?: string
    description?: string
    dialogue?: string
    aiGenerated?: boolean
  }[]) {
    if (pages.length === 0) return []
    const values = pages.map(p => ({
      workId,
      pageNumber: p.pageNumber,
      imageUrl: p.imageUrl ?? '',
      description: p.description ?? '',
      dialogue: p.dialogue ?? '',
      aiGenerated: p.aiGenerated ?? false,
    }))
    return this.db.insert(workPages).values(values).returning()
  }

  async findByWorkId(workId: string) {
    return this.db.select().from(workPages)
      .where(eq(workPages.workId, workId))
      .orderBy(asc(workPages.pageNumber))
  }

  async findByWorkIdUpToPage(workId: string, maxPage: number) {
    return this.db.select().from(workPages)
      .where(and(eq(workPages.workId, workId), lte(workPages.pageNumber, maxPage)))
      .orderBy(asc(workPages.pageNumber))
  }

  async countByWorkId(workId: string) {
    const [result] = await this.db.select({ count: sql<number>`count(*)` })
      .from(workPages)
      .where(eq(workPages.workId, workId))
    return Number(result?.count ?? 0)
  }
}
