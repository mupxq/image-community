import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { contributors, users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class ContributorsRepository {
  constructor(private db: Db) {}

  async create(data: { workId: string; userId: string; role: string }) {
    const [contributor] = await this.db.insert(contributors).values({
      workId: data.workId,
      userId: data.userId,
      role: data.role as 'creator' | 'ancestor' | 'collaborator',
    }).returning()
    return contributor
  }

  async createMany(items: { workId: string; userId: string; role: 'creator' | 'ancestor' | 'collaborator' }[]) {
    if (items.length === 0) return []
    return this.db.insert(contributors).values(items).returning()
  }

  async findByWorkId(workId: string) {
    return this.db.select({
      id: contributors.id,
      workId: contributors.workId,
      userId: contributors.userId,
      role: contributors.role,
      joinedAt: contributors.joinedAt,
      nickname: users.nickname,
      avatar: users.avatar,
    })
      .from(contributors)
      .innerJoin(users, eq(contributors.userId, users.id))
      .where(eq(contributors.workId, workId))
  }

  async findUserIdsByWorkId(workId: string) {
    const rows = await this.db.select({ userId: contributors.userId })
      .from(contributors)
      .where(eq(contributors.workId, workId))
    return rows.map(r => r.userId)
  }
}
