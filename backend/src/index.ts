import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import multer from 'multer'
import { db, pool } from './db/client'
import { config } from './config'
import { optionalAuth } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import { serializeResponse } from './middleware/serialize'

// Repositories
import { UsersRepository } from './modules/users/users.repository'
import { WorksRepository } from './modules/works/works.repository'
import { WorkPagesRepository } from './modules/works/workPages.repository'
import { ContributorsRepository } from './modules/works/contributors.repository'
import { FollowsRepository } from './modules/follows/follows.repository'
import { CommentsRepository } from './modules/comments/comments.repository'
import { LikesRepository } from './modules/likes/likes.repository'
import { SubscriptionsRepository } from './modules/subscriptions/subscriptions.repository'
import { BookmarksRepository } from './modules/bookmarks/bookmarks.repository'
import { ConversationsRepository } from './modules/messaging/conversations.repository'
import { MessagesRepository } from './modules/messaging/messages.repository'
import { CreditsRepository } from './modules/credits/credits.repository'
import { AiRepository } from './modules/ai/ai.repository'

// Services
import { AuthService } from './modules/auth/auth.service'
import { WorksService } from './modules/works/works.service'
import { SocialService } from './modules/social/social.service'
import { BookmarksService } from './modules/bookmarks/bookmarks.service'
import { MessagingService } from './modules/messaging/messaging.service'
import { CreditsService } from './modules/credits/credits.service'
import { AiService } from './modules/ai/ai.service'

// Routes
import { createAuthRouter } from './modules/auth/auth.routes'
import { createWorksRouter } from './modules/works/works.routes'
import { createSocialRouter } from './modules/social/social.routes'
import { createBookmarksRouter } from './modules/bookmarks/bookmarks.routes'
import { createMessagingRouter } from './modules/messaging/messaging.routes'
import { createCreditsRouter } from './modules/credits/credits.routes'
import { createUsersRouter } from './modules/users/users.routes'
import { createAiRouter } from './modules/ai/ai.routes'

// AI provider system (auto-initializes on import)
import './ai'

const app = express()
const PORT = config.port

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

// Global optional auth
app.use('/api', optionalAuth)

// Serialize camelCase → snake_case for API responses
app.use('/api', serializeResponse)

// ============ Wire up repositories ============
const usersRepo = new UsersRepository(db)
const worksRepo = new WorksRepository(db)
const workPagesRepo = new WorkPagesRepository(db)
const contributorsRepo = new ContributorsRepository(db)
const followsRepo = new FollowsRepository(db)
const commentsRepo = new CommentsRepository(db)
const likesRepo = new LikesRepository(db)
const subscriptionsRepo = new SubscriptionsRepository(db)
const bookmarksRepo = new BookmarksRepository(db)
const conversationsRepo = new ConversationsRepository(db)
const messagesRepo = new MessagesRepository(db)
const creditsRepo = new CreditsRepository(db)
const aiRepo = new AiRepository(db)

// ============ Wire up services ============
const authService = new AuthService(usersRepo)
const worksService = new WorksService(worksRepo, workPagesRepo, contributorsRepo)
const socialService = new SocialService(followsRepo, commentsRepo, likesRepo, subscriptionsRepo)
const bookmarksService = new BookmarksService(bookmarksRepo)
const messagingService = new MessagingService(conversationsRepo, messagesRepo)
const creditsService = new CreditsService(creditsRepo, usersRepo)
const aiService = new AiService(aiRepo)

// ============ Mount routes ============
app.use('/api/auth', createAuthRouter(authService))
app.use('/api', createWorksRouter(worksService))
app.use('/api', createSocialRouter(socialService))
app.use('/api', createBookmarksRouter(bookmarksService))
app.use('/api', createMessagingRouter(messagingService))
app.use('/api', createCreditsRouter(creditsService))
app.use('/api', createUsersRouter(usersRepo))
app.use('/api/ai', createAiRouter(aiService))

// Upload route (standalone, uses multer)
const uploadStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
  },
})
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})
app.post('/api/upload/image', require('./middleware/auth').requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// Error handler (must be after all routes)
app.use(errorHandler)

// SPA fallback for frontend build
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
app.use(express.static(clientDist))
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

// Start server
const server = app.listen(PORT, async () => {
  // Seed demo data if DB is empty
  try {
    const { default: seedData } = await import('./seed')
    await seedData()
  } catch (err) {
    console.error('[Seed] 数据初始化失败:', err)
  }
  console.log(`CoCoNut 服务已启动: http://localhost:${PORT}`)
})

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`[Shutdown] 收到 ${signal}，开始优雅关机...`)
  server.close(() => {
    console.log('[Shutdown] HTTP 服务已停止')
    pool.end()
    console.log('[Shutdown] 关机完成')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('[Shutdown] 超时，强制退出')
    pool.end()
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
