import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb, type TestDb } from '../setup'
import { UsersRepository } from '../../modules/users/users.repository'
import { ConversationsRepository } from '../../modules/messaging/conversations.repository'
import { MessagesRepository } from '../../modules/messaging/messages.repository'
import { MessagingService } from '../../modules/messaging/messaging.service'

describe('Messaging', () => {
  let testDb: TestDb
  let convRepo: ConversationsRepository
  let msgRepo: MessagesRepository
  let service: MessagingService
  let userId: string
  let user2Id: string

  beforeAll(async () => {
    testDb = await createTestDb()
    await testDb.cleanup()
    const usersRepo = new UsersRepository(testDb.db)
    const u1 = await usersRepo.create({ username: 'msg1', passwordHash: 'x', nickname: 'Msg1' })
    const u2 = await usersRepo.create({ username: 'msg2', passwordHash: 'x', nickname: 'Msg2' })
    userId = u1.id
    user2Id = u2.id

    convRepo = new ConversationsRepository(testDb.db)
    msgRepo = new MessagesRepository(testDb.db)
    service = new MessagingService(convRepo, msgRepo)
  })

  afterAll(async () => { await testDb.teardown() })

  beforeEach(async () => {
    const { messages, conversationMembers, conversations } = await import('../../db/schema')
    await testDb.db.delete(messages)
    await testDb.db.delete(conversationMembers)
    await testDb.db.delete(conversations)
  })

  // ============ Conversations ============

  describe('Conversations', () => {
    it('should create a private conversation', async () => {
      const conv = await convRepo.create({ type: 'private' })
      expect(conv.type).toBe('private')
      expect(conv.id).toBeTruthy()
    })

    it('should add members', async () => {
      const conv = await convRepo.create({ type: 'private' })
      await convRepo.addMember(conv.id, userId)
      await convRepo.addMember(conv.id, user2Id)
      const members = await convRepo.getMembers(conv.id)
      expect(members).toHaveLength(2)
    })

    it('should find existing private conversation between two users', async () => {
      const conv = await convRepo.create({ type: 'private' })
      await convRepo.addMember(conv.id, userId)
      await convRepo.addMember(conv.id, user2Id)

      const found = await convRepo.findPrivateConversation(userId, user2Id)
      expect(found).toBeTruthy()
      expect(found!.id).toBe(conv.id)
    })

    it('should return undefined when no conversation exists', async () => {
      const found = await convRepo.findPrivateConversation(userId, user2Id)
      expect(found).toBeUndefined()
    })

    it('should find conversations for a user', async () => {
      const conv = await convRepo.create({ type: 'private' })
      await convRepo.addMember(conv.id, userId)
      await convRepo.addMember(conv.id, user2Id)

      const convs = await convRepo.findByUserId(userId)
      expect(convs).toHaveLength(1)
    })

    it('should create a system conversation', async () => {
      const conv = await convRepo.create({ type: 'system', title: '系统通知' })
      await convRepo.addMember(conv.id, userId)

      const convs = await convRepo.findByUserId(userId)
      expect(convs).toHaveLength(1)
      expect(convs[0].type).toBe('system')
    })
  })

  // ============ Messages ============

  describe('Messages', () => {
    it('should create a text message', async () => {
      const conv = await convRepo.create({ type: 'private' })
      await convRepo.addMember(conv.id, userId)
      await convRepo.addMember(conv.id, user2Id)

      const msg = await msgRepo.create({
        conversationId: conv.id,
        senderId: userId,
        content: 'Hello!',
        msgType: 'text',
      })
      expect(msg.content).toBe('Hello!')
      expect(msg.msgType).toBe('text')
    })

    it('should create a system message (senderId null)', async () => {
      const conv = await convRepo.create({ type: 'system', title: '通知' })
      await convRepo.addMember(conv.id, userId)

      const msg = await msgRepo.create({
        conversationId: conv.id,
        senderId: null,
        content: JSON.stringify({ type: 'like_notify' }),
        msgType: 'system',
      })
      expect(msg.senderId).toBeNull()
      expect(msg.msgType).toBe('system')
    })

    it('should find messages by conversation', async () => {
      const conv = await convRepo.create({ type: 'private' })
      await convRepo.addMember(conv.id, userId)

      await msgRepo.create({ conversationId: conv.id, senderId: userId, content: 'M1', msgType: 'text' })
      await msgRepo.create({ conversationId: conv.id, senderId: userId, content: 'M2', msgType: 'text' })

      const messages = await msgRepo.findByConversationId(conv.id)
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('M1')
    })
  })

  // ============ Service ============

  describe('Service', () => {
    it('should get or create a conversation', async () => {
      const conv1 = await service.getOrCreateConversation(userId, user2Id)
      expect(conv1).toBeTruthy()

      const conv2 = await service.getOrCreateConversation(userId, user2Id)
      expect(conv2.id).toBe(conv1.id) // same conversation returned
    })

    it('should send a message', async () => {
      const conv = await service.getOrCreateConversation(userId, user2Id)
      const msg = await service.sendMessage(conv.id, userId, 'Hello!')
      expect(msg.content).toBe('Hello!')
    })

    it('should get conversation with messages', async () => {
      const conv = await service.getOrCreateConversation(userId, user2Id)
      await service.sendMessage(conv.id, userId, 'Hi')
      await service.sendMessage(conv.id, user2Id, 'Hey')

      const result = await service.getConversationMessages(conv.id)
      expect(result.messages).toHaveLength(2)
      expect(result.members).toHaveLength(2)
    })

    it('should list user conversations', async () => {
      await service.getOrCreateConversation(userId, user2Id)
      const convs = await service.getUserConversations(userId)
      expect(convs).toHaveLength(1)
    })

    it('should send system notification', async () => {
      const conv = await service.sendSystemNotification(userId, 'Test notification')
      expect(conv).toBeTruthy()

      const convs = await service.getUserConversations(userId)
      const systemConv = convs.find((c: any) => c.type === 'system')
      expect(systemConv).toBeTruthy()
    })

    it('should reject conversation with self', async () => {
      await expect(service.getOrCreateConversation(userId, userId))
        .rejects.toThrow('不能和自己创建会话')
    })
  })
})
