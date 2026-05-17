import { ValidationError } from '../../shared/errors'
import type { ConversationsRepository } from './conversations.repository'
import type { MessagesRepository } from './messages.repository'

export class MessagingService {
  constructor(
    private convRepo: ConversationsRepository,
    private msgRepo: MessagesRepository,
  ) {}

  async getOrCreateConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new ValidationError('不能和自己创建会话')

    const existing = await this.convRepo.findPrivateConversation(userId, targetUserId)
    if (existing) return existing

    const conv = await this.convRepo.create({ type: 'private' })
    await this.convRepo.addMember(conv.id, userId)
    await this.convRepo.addMember(conv.id, targetUserId)
    return conv
  }

  async sendMessage(conversationId: string, senderId: string, content: string, msgType = 'text') {
    return this.msgRepo.create({ conversationId, senderId, content, msgType })
  }

  async getConversationMessages(conversationId: string) {
    const conv = await this.convRepo.findById(conversationId)
    const members = await this.convRepo.getMembers(conversationId)
    const messages = await this.msgRepo.findByConversationId(conversationId)
    return { conversation: conv, members, messages }
  }

  async getUserConversations(userId: string) {
    return this.convRepo.findByUserId(userId)
  }

  async sendSystemNotification(userId: string, content: string) {
    // Find or create system conversation for this user
    const convs = await this.convRepo.findByUserId(userId)
    let systemConv = (convs as any[]).find(c => c.type === 'system')

    if (!systemConv) {
      systemConv = await this.convRepo.create({ type: 'system', title: '系统通知' })
      await this.convRepo.addMember(systemConv.id, userId)
    }

    await this.msgRepo.create({
      conversationId: systemConv.id,
      senderId: null,
      content,
      msgType: 'system',
    })

    return systemConv
  }
}
