import { eq, and, sql, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { conversations, conversationMembers, users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class ConversationsRepository {
  constructor(private db: Db) {}

  async create(data: { type: string; title?: string; workId?: string }) {
    const [row] = await this.db.insert(conversations).values({
      type: data.type as any,
      title: data.title ?? '',
      workId: data.workId ?? null,
    }).returning()
    return row
  }

  async addMember(conversationId: string, userId: string) {
    await this.db.insert(conversationMembers).values({ conversationId, userId })
  }

  async getMembers(conversationId: string) {
    return this.db.select({ id: users.id, nickname: users.nickname, avatar: users.avatar })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId))
  }

  async findPrivateConversation(userId1: string, userId2: string) {
    const result = await this.db.execute(sql`
      SELECT c.* FROM conversations c
      WHERE c.type = 'private'
        AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ${userId1})
        AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ${userId2})
        AND (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
      LIMIT 1
    `)
    return (result.rows as any[])[0] ?? undefined
  }

  async findByUserId(userId: string) {
    const result = await this.db.execute(sql`
      SELECT c.*,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m2.created_at FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ${userId}
      ORDER BY last_message_time DESC NULLS LAST
    `)
    return result.rows as any[]
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(conversations).where(eq(conversations.id, id))
    return row ?? undefined
  }
}
