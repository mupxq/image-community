import {
  pgTable, pgEnum, uuid, varchar, text, integer, boolean, timestamp, date, jsonb,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============ Enums ============

export const userStatusEnum = pgEnum('user_status', ['active', 'banned', 'deleted'])
export const workTypeEnum = pgEnum('work_type', ['comic', 'drama', 'novel'])
export const workStatusEnum = pgEnum('work_status', ['draft', 'published', 'deleted'])
export const contributorRoleEnum = pgEnum('contributor_role', ['creator', 'ancestor', 'collaborator'])
export const bookmarkStatusEnum = pgEnum('bookmark_status', ['want_read', 'reading', 'finished'])
export const conversationTypeEnum = pgEnum('conversation_type', ['private', 'group', 'system'])
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'work_share', 'system'])
export const taskStatusEnum = pgEnum('task_status', ['generating', 'completed', 'failed', 'cancelled'])
export const creditTypeEnum = pgEnum('credit_type', ['check_in', 'ai_generate', 'admin_grant', 'refund'])

// ============ Helper ============

const now = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const pk = () => uuid('id').primaryKey().defaultRandom()

// ============ 用户域 ============

export const users = pgTable('users', {
  id: pk(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  nickname: varchar('nickname', { length: 100 }).notNull(),
  avatar: text('avatar').default(''),
  bio: text('bio').default(''),
  credits: integer('credits').notNull().default(1000),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: now(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_users_username').on(table.username),
  index('idx_users_nickname').on(table.nickname),
])

export const usersRelations = relations(users, ({ many }) => ({
  works: many(works),
  follows: many(follows, { relationName: 'follower' }),
  followers: many(follows, { relationName: 'following' }),
  bookmarks: many(bookmarks),
  subscriptions: many(subscriptions),
  sentMessages: many(messages),
  conversationMembers: many(conversationMembers),
  aiConfig: many(userAiConfigs),
  generationTasks: many(generationTasks),
  checkIns: many(checkIns),
  creditLogs: many(creditLogs),
  workLikes: many(workLikes),
  pageLikes: many(pageLikes),
  comments: many(comments),
  contributors: many(contributors),
}))

// ============ 作品域 ============

export const works = pgTable('works', {
  id: pk(),
  title: varchar('title', { length: 200 }).notNull(),
  subtitle: varchar('subtitle', { length: 200 }).default(''),
  description: text('description').default(''),
  coverImage: text('cover_image').default(''),
  type: workTypeEnum('type').notNull().default('comic'),
  status: workStatusEnum('status').notNull().default('draft'),
  allowFork: boolean('allow_fork').notNull().default(true),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  parentWorkId: uuid('parent_work_id').references((): any => works.id),
  rootWorkId: uuid('root_work_id').references((): any => works.id),
  forkFromPage: integer('fork_from_page'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_works_creator').on(table.creatorId),
  index('idx_works_parent').on(table.parentWorkId),
  index('idx_works_root').on(table.rootWorkId),
  index('idx_works_status_type').on(table.status, table.type),
  index('idx_works_created').on(table.createdAt),
])

export const worksRelations = relations(works, ({ one, many }) => ({
  creator: one(users, { fields: [works.creatorId], references: [users.id] }),
  parentWork: one(works, { fields: [works.parentWorkId], references: [works.id], relationName: 'workTree' }),
  rootWork: one(works, { fields: [works.rootWorkId], references: [works.id], relationName: 'workRoot' }),
  pages: many(workPages),
  contributors: many(contributors),
  comments: many(comments),
  likes: many(workLikes),
  bookmarks: many(bookmarks),
  subscriptions: many(subscriptions),
}))

// 作品页面
export const workPages = pgTable('work_pages', {
  id: pk(),
  workId: uuid('work_id').notNull().references(() => works.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  imageUrl: text('image_url').default(''),
  description: text('description').default(''),
  dialogue: text('dialogue').default(''),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_pages_work_page').on(table.workId, table.pageNumber),
])

export const workPagesRelations = relations(workPages, ({ one, many }) => ({
  work: one(works, { fields: [workPages.workId], references: [works.id] }),
  likes: many(pageLikes),
}))

// 共创贡献者
export const contributors = pgTable('contributors', {
  id: pk(),
  workId: uuid('work_id').notNull().references(() => works.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: contributorRoleEnum('role').notNull().default('creator'),
  joinedAt: now(),
}, (table) => [
  uniqueIndex('idx_contributors_unique').on(table.workId, table.userId),
  index('idx_contributors_work').on(table.workId),
  index('idx_contributors_user').on(table.userId),
])

export const contributorsRelations = relations(contributors, ({ one }) => ({
  work: one(works, { fields: [contributors.workId], references: [works.id] }),
  user: one(users, { fields: [contributors.userId], references: [users.id] }),
}))

// ============ 社交域 ============

export const follows = pgTable('follows', {
  id: pk(),
  followerId: uuid('follower_id').notNull().references(() => users.id),
  followingId: uuid('following_id').notNull().references(() => users.id),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_follows_unique').on(table.followerId, table.followingId),
  index('idx_follows_follower').on(table.followerId),
  index('idx_follows_following').on(table.followingId),
])

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id], relationName: 'follower' }),
  following: one(users, { fields: [follows.followingId], references: [users.id], relationName: 'following' }),
}))

// 作品点赞
export const workLikes = pgTable('work_likes', {
  id: pk(),
  workId: uuid('work_id').notNull().references(() => works.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_work_likes_unique').on(table.workId, table.userId),
  index('idx_work_likes_work').on(table.workId),
])

export const workLikesRelations = relations(workLikes, ({ one }) => ({
  work: one(works, { fields: [workLikes.workId], references: [works.id] }),
  user: one(users, { fields: [workLikes.userId], references: [users.id] }),
}))

// 页面点赞
export const pageLikes = pgTable('page_likes', {
  id: pk(),
  pageId: uuid('page_id').notNull().references(() => workPages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_page_likes_unique').on(table.pageId, table.userId),
  index('idx_page_likes_page').on(table.pageId),
])

export const pageLikesRelations = relations(pageLikes, ({ one }) => ({
  page: one(workPages, { fields: [pageLikes.pageId], references: [workPages.id] }),
  user: one(users, { fields: [pageLikes.userId], references: [users.id] }),
}))

// 评论
export const comments = pgTable('comments', {
  id: pk(),
  workId: uuid('work_id').notNull().references(() => works.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  createdAt: now(),
}, (table) => [
  index('idx_comments_work').on(table.workId),
  index('idx_comments_parent').on(table.parentId),
  index('idx_comments_user').on(table.userId),
])

export const commentsRelations = relations(comments, ({ one, many }) => ({
  work: one(works, { fields: [comments.workId], references: [works.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  parent: one(comments, { fields: [comments.parentId], references: [comments.id], relationName: 'commentReplies' }),
  replies: many(comments, { relationName: 'commentReplies' }),
}))

// ============ 阅读域 ============

export const bookmarks = pgTable('bookmarks', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id),
  workId: uuid('work_id').notNull().references(() => works.id),
  readStatus: bookmarkStatusEnum('read_status').notNull().default('want_read'),
  lastReadPage: integer('last_read_page').notNull().default(0),
  createdAt: now(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('idx_bookmarks_unique').on(table.userId, table.workId),
  index('idx_bookmarks_user').on(table.userId),
  index('idx_bookmarks_user_status').on(table.userId, table.readStatus),
])

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  work: one(works, { fields: [bookmarks.workId], references: [works.id] }),
}))

// 订阅
export const subscriptions = pgTable('subscriptions', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id),
  workId: uuid('work_id').notNull().references(() => works.id),
  lastViewedForkCount: integer('last_viewed_fork_count').notNull().default(0),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_subscriptions_unique').on(table.userId, table.workId),
  index('idx_subscriptions_user').on(table.userId),
])

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  work: one(works, { fields: [subscriptions.workId], references: [works.id] }),
}))

// ============ 消息域 ============

export const conversations = pgTable('conversations', {
  id: pk(),
  type: conversationTypeEnum('type').notNull().default('private'),
  title: varchar('title', { length: 200 }).default(''),
  workId: uuid('work_id'),
  createdAt: now(),
})

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  work: one(works, { fields: [conversations.workId], references: [works.id] }),
  members: many(conversationMembers),
  messages: many(messages),
}))

export const conversationMembers = pgTable('conversation_members', {
  id: pk(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  joinedAt: now(),
}, (table) => [
  uniqueIndex('idx_conv_members_unique').on(table.conversationId, table.userId),
  index('idx_conv_members_conv').on(table.conversationId),
  index('idx_conv_members_user').on(table.userId),
])

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [conversationMembers.userId], references: [users.id] }),
}))

export const messages = pgTable('messages', {
  id: pk(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id'),
  content: text('content').notNull(),
  msgType: messageTypeEnum('msg_type').notNull().default('text'),
  createdAt: now(),
}, (table) => [
  index('idx_messages_conv').on(table.conversationId, table.createdAt),
])

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}))

// ============ AI 域 ============

export const userAiConfigs = pgTable('user_ai_configs', {
  id: pk(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  textBaseUrl: text('text_base_url').default(''),
  textApiKey: text('text_api_key').default(''),
  textModel: text('text_model').default(''),
  imageBaseUrl: text('image_base_url').default(''),
  imageApiKey: text('image_api_key').default(''),
  imageModel: text('image_model').default(''),
  createdAt: now(),
  updatedAt: updatedAt(),
})

export const userAiConfigsRelations = relations(userAiConfigs, ({ one }) => ({
  user: one(users, { fields: [userAiConfigs.userId], references: [users.id] }),
}))

export const generationTasks = pgTable('generation_tasks', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: taskStatusEnum('status').notNull().default('generating'),
  type: workTypeEnum('type').notNull().default('comic'),
  inputParams: jsonb('input_params').notNull().default({}),
  result: jsonb('result'),
  error: text('error'),
  creditsUsed: integer('credits_used').notNull().default(0),
  createdAt: now(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_tasks_user').on(table.userId),
  index('idx_tasks_status').on(table.userId, table.status),
])

export const generationTasksRelations = relations(generationTasks, ({ one }) => ({
  user: one(users, { fields: [generationTasks.userId], references: [users.id] }),
}))

export const checkIns = pgTable('check_ins', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id),
  checkDate: date('check_date').notNull(),
  streak: integer('streak').notNull().default(1),
  creditsEarned: integer('credits_earned').notNull(),
  createdAt: now(),
}, (table) => [
  uniqueIndex('idx_checkins_unique').on(table.userId, table.checkDate),
])

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  user: one(users, { fields: [checkIns.userId], references: [users.id] }),
}))

export const creditLogs = pgTable('credit_logs', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  type: creditTypeEnum('type').notNull(),
  description: text('description').default(''),
  taskId: uuid('task_id'),
  createdAt: now(),
}, (table) => [
  index('idx_credit_logs_user').on(table.userId),
  index('idx_credit_logs_task').on(table.taskId),
])

export const creditLogsRelations = relations(creditLogs, ({ one }) => ({
  user: one(users, { fields: [creditLogs.userId], references: [users.id] }),
  task: one(generationTasks, { fields: [creditLogs.taskId], references: [generationTasks.id] }),
}))
