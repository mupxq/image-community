import { eq, and, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { subscriptions, works, users, workPages } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class SubscriptionsRepository {
  constructor(private db: Db) {}

  async create(data: { userId: string; workId: string; lastViewedForkCount?: number }) {
    const [row] = await this.db.insert(subscriptions).values({
      userId: data.userId,
      workId: data.workId,
      lastViewedForkCount: data.lastViewedForkCount ?? 0,
    }).returning()
    return row
  }

  async delete(userId: string, workId: string) {
    const result = await this.db.delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.workId, workId)))
      .returning()
    return result.length > 0
  }

  async findByUserAndWork(userId: string, workId: string) {
    const [row] = await this.db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.workId, workId)))
    return row ?? undefined
  }

  async findByUserId(userId: string) {
    return this.db.select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      workId: subscriptions.workId,
      lastViewedForkCount: subscriptions.lastViewedForkCount,
      createdAt: subscriptions.createdAt,
      title: works.title,
      description: works.description,
      type: works.type,
      coverImage: works.coverImage,
      creatorName: users.nickname,
      creatorAvatar: users.avatar,
    })
      .from(subscriptions)
      .innerJoin(works, eq(subscriptions.workId, works.id))
      .innerJoin(users, eq(works.creatorId, users.id))
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
  }

  async updateViewedCount(userId: string, workId: string, count: number) {
    await this.db.update(subscriptions).set({ lastViewedForkCount: count })
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.workId, workId)))
  }
}
