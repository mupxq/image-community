import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from '../db/schema'

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://coconut:coconut_dev@localhost:5432/coconut_test'

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

export async function createTestDb() {
  const pool = new Pool({ connectionString: TEST_DB_URL })
  const db = drizzle(pool, { schema })

  await migrate(db, { migrationsFolder: './src/db/migrations' })

  return {
    db,
    pool,
    async cleanup() {
      await db.delete(schema.creditLogs)
      await db.delete(schema.checkIns)
      await db.delete(schema.generationTasks)
      await db.delete(schema.userAiConfigs)
      await db.delete(schema.messages)
      await db.delete(schema.conversationMembers)
      await db.delete(schema.conversations)
      await db.delete(schema.subscriptions)
      await db.delete(schema.bookmarks)
      await db.delete(schema.pageLikes)
      await db.delete(schema.workLikes)
      await db.delete(schema.comments)
      await db.delete(schema.follows)
      await db.delete(schema.contributors)
      await db.delete(schema.workPages)
      await db.delete(schema.works)
      await db.delete(schema.users)
    },
    async teardown() {
      await pool.end()
    },
  }
}
