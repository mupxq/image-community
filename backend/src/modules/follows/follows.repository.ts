import { eq, and, sql, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { follows, users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class FollowsRepository {
  constructor(private db: Db) {}

  async create(data: { followerId: string; followingId: string }) {
    const [row] = await this.db.insert(follows).values(data).returning()
    return row
  }

  async delete(followerId: string, followingId: string) {
    const result = await this.db.delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .returning()
    return result.length > 0
  }

  async isFollowing(followerId: string, followingId: string) {
    const [row] = await this.db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    return !!row
  }

  async countFollowers(userId: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` })
      .from(follows).where(eq(follows.followingId, userId))
    return Number(row.count)
  }

  async countFollowing(userId: string) {
    const [row] = await this.db.select({ count: sql<number>`count(*)` })
      .from(follows).where(eq(follows.followerId, userId))
    return Number(row.count)
  }

  async findFollowers(userId: string) {
    return this.db.select({ id: users.id, nickname: users.nickname, avatar: users.avatar, bio: users.bio })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
  }

  async findFollowing(userId: string) {
    return this.db.select({ id: users.id, nickname: users.nickname, avatar: users.avatar, bio: users.bio })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt))
  }

  async findMutuals(userId: string) {
    const result = await this.db.execute(sql`
      SELECT u.id, u.nickname, u.avatar, u.username
      FROM follows f1
      JOIN follows f2 ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
      JOIN users u ON f1.following_id = u.id
      WHERE f1.follower_id = ${userId}
      ORDER BY u.nickname ASC
    `)
    return result.rows
  }
}
