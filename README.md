# CoCoNut — AI 协作创作社区

AI 驱动的协作创作社区平台。用户创作漫画/短剧/小说，通过分叉续写形成创作树，支持 AI 辅助生成、书架管理、社交互动和私信系统。

## 功能

- **作品发现** — 浏览漫画、短剧、小说，按类型筛选和排序
- **创作系统** — 手动创作 + AI 辅助创作（多风格、多 Provider）
- **故事分叉** — 基于已有作品续写新分支，形成创作树
- **贡献溯源** — 自动追踪上游创作者，记录共创关系链
- **创作树可视化** — 展示作品的所有分支和演变路径
- **书架管理** — 收藏作品，追踪阅读状态和进度
- **社交互动** — 关注、评论、点赞、订阅更新
- **消息系统** — 私聊，支持作品分享和系统通知
- **积分体系** — 每日签到获取积分，积分用于 AI 创作
- **AI 多 Provider** — 支持火山引擎/豆包、OpenAI，可切换平台或自定义 API

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express 5 + TypeScript |
| 数据库 | PostgreSQL 16 + Drizzle ORM |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 (暗色主题) |
| 状态管理 | React Context + Hooks |
| 路由 | React Router (HashRouter) |
| 认证 | JWT (Bearer Token) |
| AI | OpenAI SDK (兼容多 Provider) |
| 测试 | Vitest + Supertest |
| 部署 | PM2 + Docker |

## 快速开始

### 前置要求

- Node.js 18+
- Docker (用于 PostgreSQL)

### 1. 启动数据库

```bash
docker compose up -d
```

这会启动一个 PostgreSQL 16 实例（端口 5432），自动创建 `coconut_dev` 数据库。

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env`，按需填入 AI Provider 的 API Key（不填则默认使用 mock Provider）。

### 3. 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd ../client && npm install
```

### 4. 初始化数据库

```bash
cd backend
npm run db:push    # 推送表结构到数据库
npm run seed       # 填充演示数据（可选）
```

### 5. 启动开发服务

```bash
# 后端（端口 3000）
cd backend && npm start

# 前端（端口 5173，自动代理 /api 和 /uploads 到后端）
cd client && npm run dev
```

打开 http://localhost:5173 即可访问。

## 常用命令

```bash
# 后端
cd backend
npm start              # 启动后端服务
npm test               # 运行全部测试
npx vitest run src/test/modules/users.repository.test.ts  # 运行单个测试
npm run lint            # ESLint 检查
npm run format          # Prettier 格式化
npm run db:generate     # 从 schema 变更生成 migration
npm run db:migrate      # 应用 migration
npm run db:push         # 直接推送 schema（仅开发用）
npm run db:studio       # Drizzle Studio 可视化管理

# 前端
cd client
npm run dev             # 启动开发服务器
npm run build           # 生产构建

# 生产部署
pm2 start ecosystem.config.js
```

## 项目结构

```
image-community/
├── backend/                # Express 5 + PostgreSQL + Drizzle ORM
│   ├── src/
│   │   ├── index.ts        # Express 入口，DI 装配，中间件
│   │   ├── config.ts       # 环境变量集中管理
│   │   ├── seed.ts         # 演示数据填充
│   │   ├── db/             # 数据库层
│   │   │   ├── schema.ts   # Drizzle schema (17 表, 9 枚举, UUID PK)
│   │   │   └── client.ts   # 数据库连接
│   │   ├── middleware/      # Express 中间件
│   │   │   ├── auth.ts      # JWT 认证
│   │   │   ├── validate.ts  # Zod 校验
│   │   │   ├── errorHandler.ts  # 全局错误处理
│   │   │   └── serialize.ts     # camelCase → snake_case 序列化
│   │   ├── modules/         # 功能模块 (Route → Service → Repository)
│   │   │   ├── auth/        # 注册、登录
│   │   │   ├── users/       # 用户资料、头像
│   │   │   ├── works/       # 作品 CRUD、分叉、创作树
│   │   │   ├── social/      # 关注、评论、点赞、订阅
│   │   │   ├── bookmarks/   # 书架管理
│   │   │   ├── messaging/   # 私信、系统通知
│   │   │   ├── credits/     # 签到、积分
│   │   │   └── ai/          # AI 生成、任务管理
│   │   ├── ai/              # AI Provider 系统（可插拔）
│   │   │   ├── providers/   # mock, openai, volcengine
│   │   │   └── registry.ts  # Provider 注册中心
│   │   └── test/            # 测试文件 (Vitest + Supertest)
│   ├── drizzle.config.ts
│   └── vitest.config.ts
├── client/                 # React 19 + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── api/index.ts    # 后端 API 调用封装
│   │   ├── contexts/       # UserContext (JWT 状态)
│   │   ├── components/     # 可复用 UI 组件
│   │   ├── pages/          # 页面组件
│   │   ├── types.ts        # TypeScript 类型定义
│   │   └── App.tsx         # HashRouter 路由
│   └── vite.config.js      # 代理 /api 和 /uploads
├── docker-compose.yml      # PostgreSQL 16 Alpine
├── ecosystem.config.js     # PM2 生产配置
└── CLAUDE.md               # 开发指南
```

## 架构

### 分层架构

每个功能模块遵循 **Route → Service → Repository** 三层架构，通过依赖注入组装：

```
Route (Express handler, Zod 校验, JWT 认证)
  → Service (业务逻辑, 错误处理)
    → Repository (Drizzle ORM 查询)
```

路由通过工厂函数创建：`createWorksRouter(worksService)`，在 `index.ts` 中完成 DI 装配。

### 数据库

PostgreSQL 16，17 张表，UUID v4 主键：

- **核心:** `users`, `works`, `work_pages`, `contributors`, `comments`
- **社交:** `follows`, `work_likes`, `page_likes`, `subscriptions`
- **阅读:** `bookmarks`, `check_ins`, `credit_logs`
- **消息:** `conversations`, `conversation_members`, `messages`
- **AI:** `user_ai_configs`, `generation_tasks`

作品通过 `parent_work_id` / `root_work_id` 形成树形分叉结构。Contributors 追踪直接创作者和上游祖先链。

### AI 系统

可插拔 Provider 架构，两种模式：

- **平台模式:** 使用积分（签到获取：100/天，每 7 天 500），调用平台配置的 Provider
- **自定义模式:** 用户在前端填入自己的 API Key，不消耗积分

生成异步执行，创建 `generation_task` 跟踪状态（`generating` → `completed`/`failed`/`cancelled`）。

### 认证

JWT Bearer Token。前端存 localStorage，401 响应自动登出跳转登录页。

## License

ISC
