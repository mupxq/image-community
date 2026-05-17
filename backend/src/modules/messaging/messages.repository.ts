import { eq, asc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'
import { messages, users } from '../../db/schema'

type Db = NodePgDatabase<typeof schema>

export class MessagesRepository {
  constructor(private db: Db) {}

  async create(data: { conversationId: string; senderId: string | null; content: string; msgType: string }) {
    const [row] = await this.db.insert(messages).values({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      msgType: data.msgType as any,
    }).returning()
    return row
  }

  async findByConversationId(conversationId: string) {
    const result = await this.db.execute(sql`
      SELECT m.*, COALESCE(u.nickname, '系统') as sender_name, COALESCE(u.avatar, '') as sender_avatar
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ${conversationId}
      ORDER BY m.created_at ASC
    `)
    return result.rows as any[]
  }
}
