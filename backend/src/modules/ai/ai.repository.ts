import { eq, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { generationTasks, userAiConfigs, users, creditLogs } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class AiRepository {
  constructor(private db: Db) {}

  // ============ Generation Tasks ============

  async createTask(data: { userId: string; type: string; inputParams: any }) {
    const [row] = await this.db.insert(generationTasks).values({
      userId: data.userId,
      type: data.type as any,
      inputParams: data.inputParams,
    }).returning()
    return row
  }

  async getTaskById(id: string, userId: string) {
    const [row] = await this.db.select().from(generationTasks)
      .where(eq(generationTasks.id, id))
      .limit(1)
    if (!row || row.userId !== userId) return undefined
    return row
  }

  async getUserTasks(userId: string) {
    return this.db.select({
      id: generationTasks.id,
      status: generationTasks.status,
      type: generationTasks.type,
      creditsUsed: generationTasks.creditsUsed,
      createdAt: generationTasks.createdAt,
      completedAt: generationTasks.completedAt,
      error: generationTasks.error,
    }).from(generationTasks)
      .where(eq(generationTasks.userId, userId))
      .orderBy(desc(generationTasks.createdAt))
      .limit(20)
  }

  async updateTask(id: string, data: { status?: string; result?: any; error?: string; creditsUsed?: number; completedAt?: Date }) {
    const [row] = await this.db.update(generationTasks).set(data as any)
      .where(eq(generationTasks.id, id))
      .returning()
    return row
  }

  async deleteTask(id: string) {
    await this.db.delete(generationTasks).where(eq(generationTasks.id, id))
  }

  // ============ AI Config ============

  async getConfig(userId: string) {
    const [row] = await this.db.select().from(userAiConfigs)
      .where(eq(userAiConfigs.userId, userId))
    return row ?? undefined
  }

  async upsertConfig(userId: string, data: {
    textBaseUrl?: string; textApiKey?: string; textModel?: string;
    imageBaseUrl?: string; imageApiKey?: string; imageModel?: string;
  }) {
    const existing = await this.getConfig(userId)
    if (existing) {
      const [row] = await this.db.update(userAiConfigs).set({
        ...data,
        updatedAt: new Date(),
      }).where(eq(userAiConfigs.userId, userId)).returning()
      return row
    }
    const [row] = await this.db.insert(userAiConfigs).values({
      userId,
      ...data,
    }).returning()
    return row
  }

  // ============ Credits ============

  async getUserCredits(userId: string) {
    const [row] = await this.db.select({ credits: users.credits }).from(users)
      .where(eq(users.id, userId))
    return row?.credits
  }

  async deductCredits(userId: string, amount: number) {
    await this.db.update(users).set({
      credits: sql`${users.credits} - ${amount}`,
      updatedAt: new Date(),
    }).where(eq(users.id, userId))
  }

  async createCreditLog(data: { userId: string; amount: number; type: string; description: string; taskId?: string }) {
    const [row] = await this.db.insert(creditLogs).values({
      userId: data.userId,
      amount: data.amount,
      type: data.type as any,
      description: data.description,
      taskId: data.taskId ?? null,
    }).returning()
    return row
  }
}
