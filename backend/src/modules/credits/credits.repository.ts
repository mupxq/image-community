import { eq, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { checkIns, creditLogs } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class CreditsRepository {
  constructor(private db: Db) {}

  async createCheckIn(data: { userId: string; checkDate: string; streak: number; creditsEarned: number }) {
    const [row] = await this.db.insert(checkIns).values({
      userId: data.userId,
      checkDate: data.checkDate,
      streak: data.streak,
      creditsEarned: data.creditsEarned,
    }).returning()
    return row
  }

  async getLastCheckIn(userId: string) {
    const rows = await this.db.select().from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.checkDate))
      .limit(1)
    return rows[0] ?? undefined
  }

  async getTodayCheckIn(userId: string, date: string) {
    const rows = await this.db.select().from(checkIns)
      .where(sql`${checkIns.userId} = ${userId} AND ${checkIns.checkDate} = ${date}`)
    return rows[0] ?? undefined
  }

  async createLog(data: { userId: string; amount: number; type: string; description: string; taskId?: string }) {
    const [row] = await this.db.insert(creditLogs).values({
      userId: data.userId,
      amount: data.amount,
      type: data.type as any,
      description: data.description,
      taskId: data.taskId ?? null,
    }).returning()
    return row
  }

  async getLogs(userId: string) {
    return this.db.select().from(creditLogs)
      .where(eq(creditLogs.userId, userId))
      .orderBy(desc(creditLogs.createdAt))
      .limit(50)
  }
}
