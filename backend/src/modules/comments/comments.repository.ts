import { eq, sql, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { comments, users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class CommentsRepository {
  constructor(private db: Db) {}

  async create(data: { workId: string; userId: string; content: string; parentId?: string }) {
    const [row] = await this.db.insert(comments).values({
      workId: data.workId,
      userId: data.userId,
      content: data.content,
      parentId: data.parentId ?? null,
    }).returning()
    return row
  }

  async findByWorkId(workId: string) {
    const result = await this.db.execute(sql`
      SELECT c.id, c.work_id, c.user_id, c.parent_id, c.content, c.created_at,
        u.nickname, u.avatar,
        ru.nickname as reply_to_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN comments pc ON c.parent_id = pc.id
      LEFT JOIN users ru ON pc.user_id = ru.id
      WHERE c.work_id = ${workId}
      ORDER BY c.created_at ASC
    `)
    return result.rows
  }

  async delete(commentId: string, userId: string) {
    // Only author can delete
    const [existing] = await this.db.select().from(comments).where(eq(comments.id, commentId))
    if (!existing || existing.userId !== userId) return false

    // Delete child replies first, then the comment itself
    await this.db.delete(comments).where(eq(comments.parentId, commentId))
    await this.db.delete(comments).where(eq(comments.id, commentId))
    return true
  }

  async countByWorkId(workId: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` })
      .from(comments).where(eq(comments.workId, workId))
    return Number(row.count)
  }
}
