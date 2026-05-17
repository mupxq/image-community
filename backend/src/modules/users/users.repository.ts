import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class UsersRepository {
  constructor(private db: Db) {}

  async create(data: { username: string; passwordHash: string; nickname: string }) {
    const [user] = await this.db.insert(users).values({
      username: data.username,
      passwordHash: data.passwordHash,
      nickname: data.nickname,
    }).returning()
    return user
  }

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id))
    return user ?? undefined
  }

  async findByUsername(username: string) {
    const [user] = await this.db.select().from(users).where(eq(users.username, username))
    return user ?? undefined
  }

  async updateProfile(id: string, data: { nickname?: string; bio?: string; avatar?: string }) {
    const [updated] = await this.db.update(users).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning()
    return updated ?? undefined
  }

  async updateCredits(id: string, credits: number) {
    const [updated] = await this.db.update(users).set({
      credits,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning()
    return updated ?? undefined
  }
}
