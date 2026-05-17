# CoCoNut 企业级重构计划

> 将 CoCoNut 从原型/Demo 阶段重构为企业级工程化项目

---

## 一、现状问题诊断

### 1.1 数据库层

| 问题 | 影响 |
|------|------|
| SQLite 单文件，无并发写入能力 | 多用户同时操作时锁竞争严重，AI 生成长事务阻塞其他请求 |
| 迁移靠 PRAGMA + ALTER TABLE 拼凑 | 已有 6+ 段迁移代码散落在 database.ts，无法回滚，不可靠 |
| 无索引设计 | work_pages、comments、messages 等表缺少索引，数据量增长后查询退化 |
| 无数据校验层 | 外键约束依赖 SQLite pragma，应用层无校验，脏数据风险高 |
| 文件存储本地磁盘 | 无 CDN、无备份策略，服务器挂了图就没了 |

### 1.2 后端架构

| 问题 | 影响 |
|------|------|
| 所有路由堆在 routes.ts (743 行) | 单文件巨型路由，维护困难，无法分工 |
| SQL 语句散落在路由处理函数中 | 无数据访问层，SQL 与业务逻辑耦合，无法复用和测试 |
| 无错误处理中间件 | 每个路由手动 try/catch，遗漏时直接 500 崩溃 |
| 无输入校验 | 靠手动 if 检查，不完整也不统一 |
| AI 生成逻辑与路由耦合 | aiRoutes.ts 有 615 行，生成/取消/重试逻辑混杂 |
| 无测试 | 0 个测试用例，任何改动都有破坏现有功能的风险 |

### 1.3 前端

| 问题 | 影响 |
|------|------|
| API 调用无统一错误处理 | 401 处理散落在各处 |
| 无组件测试 | UI 变更无法验证 |

---

## 二、重构目标

1. **数据库稳定可靠** — 迁移到 PostgreSQL，支持并发、事务、完善约束
2. **TDD 驱动开发** — 先写测试再写代码，保证每次变更的安全性
3. **分层架构** — Route → Service → Repository，职责清晰可测试
4. **渐进式迁移** — 分阶段执行，每个阶段可独立验证，不一次性推翻重写

---

## 三、技术选型

| 层 | 现状 | 目标 | 理由 |
|----|------|------|------|
| 数据库 | SQLite | **PostgreSQL** | 并发写入、JSONB 支持（AI 任务参数）、全文搜索、成熟生态 |
| ORM / 查询 | 手写 SQL | **Drizzle ORM** | 类型安全、轻量、SQL-like API、迁移工具内置、零运行时开销 |
| 校验 | 手动 if | **Zod** | 类型推导、统一校验层、与 Drizzle schema 联动 |
| 测试 | 无 | **Vitest** | 与 Vite 生态一致、速度快、TypeScript 原生支持 |
| API 测试 | 无 | **Supertest** | HTTP 层集成测试，配合 Vitest |
| 代码规范 | 无 | **ESLint + Prettier** | 统一风格，已有 ESLint 依赖 |

---

## 四、数据库重新设计

### 4.1 设计原则

- 所有表加 `created_at`、`updated_at`（由应用层统一管理）
- 所有货币/积分字段用 `INTEGER`（分为单位，避免浮点）
- JSON 字段用 PostgreSQL `JSONB`（AI 任务参数等）
- 软删除 vs 硬删除：`works` 软删除（`deleted_at`），其他表硬删除
- 为所有外键查询创建索引
- `enum` 类型用 PostgreSQL 原生 `ENUM`

### 4.2 Schema 设计

```sql
-- ============ 用户域 ============

CREATE TYPE user_status AS ENUM ('active', 'banned', 'deleted');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname      VARCHAR(100) NOT NULL,
  avatar        TEXT DEFAULT '',
  bio           TEXT DEFAULT '',
  credits       INTEGER NOT NULL DEFAULT 1000 CHECK (credits >= 0),
  status        user_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_nickname ON users(nickname);

-- ============ 作品域 ============

CREATE TYPE work_type AS ENUM ('comic', 'drama', 'novel');
CREATE TYPE work_status AS ENUM ('draft', 'published', 'deleted');

CREATE TABLE works (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  subtitle        VARCHAR(200) DEFAULT '',
  description     TEXT DEFAULT '',
  cover_image     TEXT DEFAULT '',
  type            work_type NOT NULL DEFAULT 'comic',
  status          work_status NOT NULL DEFAULT 'draft',
  allow_fork      BOOLEAN NOT NULL DEFAULT true,
  creator_id      UUID NOT NULL REFERENCES users(id),
  parent_work_id  UUID REFERENCES works(id),
  root_work_id    UUID REFERENCES works(id),
  fork_from_page  INTEGER DEFAULT NULL,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,  -- 软删除
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_works_creator ON works(creator_id);
CREATE INDEX idx_works_parent ON works(parent_work_id) WHERE parent_work_id IS NOT NULL;
CREATE INDEX idx_works_root ON works(root_work_id) WHERE root_work_id IS NOT NULL;
CREATE INDEX idx_works_status_type ON works(status, type);
CREATE INDEX idx_works_created ON works(created_at DESC);

-- 作品页面
CREATE TABLE work_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id       UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  page_number   INTEGER NOT NULL CHECK (page_number > 0),
  image_url     TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  dialogue      TEXT DEFAULT '',
  ai_generated  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pages_work ON work_pages(work_id, page_number);
CREATE UNIQUE INDEX idx_pages_work_page ON work_pages(work_id, page_number);

-- 共创贡献者
CREATE TYPE contributor_role AS ENUM ('creator', 'ancestor', 'collaborator');

CREATE TABLE contributors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  role       contributor_role NOT NULL DEFAULT 'creator',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_id, user_id)
);

CREATE INDEX idx_contributors_work ON contributors(work_id);
CREATE INDEX idx_contributors_user ON contributors(user_id);

-- ============ 社交域 ============

CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id),
  following_id UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- 作品点赞
CREATE TABLE work_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_id, user_id)
);

CREATE INDEX idx_work_likes_work ON work_likes(work_id);

-- 页面点赞
CREATE TABLE page_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    UUID NOT NULL REFERENCES work_pages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

CREATE INDEX idx_page_likes_page ON page_likes(page_id);

-- 评论（支持嵌套回复）
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_work ON comments(work_id);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_user ON comments(user_id);

-- ============ 阅读域 ============

CREATE TYPE bookmark_status AS ENUM ('want_read', 'reading', 'finished');

CREATE TABLE bookmarks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  work_id        UUID NOT NULL REFERENCES works(id),
  read_status    bookmark_status NOT NULL DEFAULT 'want_read',
  last_read_page INTEGER NOT NULL DEFAULT 0 CHECK (last_read_page >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, work_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_user_status ON bookmarks(user_id, read_status);

-- 订阅
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  work_id                 UUID NOT NULL REFERENCES works(id),
  last_viewed_fork_count  INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, work_id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ============ 消息域 ============

CREATE TYPE conversation_type AS ENUM ('private', 'group', 'system');
CREATE TYPE message_type AS ENUM ('text', 'image', 'work_share', 'system');

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       conversation_type NOT NULL DEFAULT 'private',
  title      VARCHAR(200) DEFAULT '',
  work_id    UUID REFERENCES works(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_members_conv ON conversation_members(conversation_id);
CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id),  -- NULL = 系统发送
  content         TEXT NOT NULL,
  msg_type        message_type NOT NULL DEFAULT 'text',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

-- ============ AI 域 ============

CREATE TYPE task_status AS ENUM ('generating', 'completed', 'failed', 'cancelled');
CREATE TYPE credit_type AS ENUM ('check_in', 'ai_generate', 'admin_grant', 'refund');

CREATE TABLE user_ai_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id),
  text_base_url TEXT DEFAULT '',
  text_api_key  TEXT DEFAULT '',
  text_model    TEXT DEFAULT '',
  image_base_url TEXT DEFAULT '',
  image_api_key TEXT DEFAULT '',
  image_model   TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generation_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  status       task_status NOT NULL DEFAULT 'generating',
  type         work_type NOT NULL DEFAULT 'comic',
  input_params JSONB NOT NULL DEFAULT '{}',
  result       JSONB DEFAULT NULL,
  error        TEXT DEFAULT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_tasks_user ON generation_tasks(user_id);
CREATE INDEX idx_tasks_status ON generation_tasks(user_id, status);

CREATE TABLE check_ins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  check_date    DATE NOT NULL,
  streak        INTEGER NOT NULL DEFAULT 1 CHECK (streak >= 1),
  credits_earned INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, check_date)
);

CREATE INDEX idx_checkins_user_date ON check_ins(user_id, check_date DESC);

CREATE TABLE credit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      INTEGER NOT NULL,
  type        credit_type NOT NULL,
  description TEXT DEFAULT '',
  task_id     UUID REFERENCES generation_tasks(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_logs_user ON credit_logs(user_id);
CREATE INDEX idx_credit_logs_task ON credit_logs(task_id) WHERE task_id IS NOT NULL;
```

### 4.3 关键设计决策

| 决策 | 说明 |
|------|------|
| **UUID 主键** | 替代自增 ID，防止枚举攻击，分布式友好 |
| **ON DELETE CASCADE** | work_pages、contributors 等随 works 级联删除 |
| **ON DELETE SET NULL** 不用于 parent_work_id | 父作品删除时子作品断链不好，用软删除避免 |
| **JSONB 用于 AI 参数** | input_params 和 result 结构灵活，适合 JSONB |
| **check_ins 的 UNIQUE(user_id, check_date)** | 数据库层面保证每天只能签到一次 |
| **comments 的 content 长度约束** | CHECK(0 < length <= 2000)，数据库层兜底 |

---

## 五、后端架构重构

### 5.1 分层结构

```
backend/src/
├── index.ts              # Express 启动、中间件注册
├── config.ts             # 环境变量、配置
├── db/
│   ├── client.ts         # PostgreSQL 连接（Drizzle）
│   ├── schema.ts         # Drizzle schema 定义
│   └── migrations/       # Drizzle 迁移文件
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.test.ts
│   │   └── auth.schema.ts      # Zod 校验
│   ├── works/
│   │   ├── works.routes.ts
│   │   ├── works.service.ts
│   │   ├── works.repository.ts
│   │   ├── works.test.ts
│   │   └── works.schema.ts
│   ├── comments/
│   ├── bookmarks/
│   ├── messages/
│   ├── ai/
│   │   ├── ai.routes.ts
│   │   ├── ai.service.ts       # 生成编排逻辑
│   │   ├── ai.repository.ts
│   │   ├── ai.test.ts
│   │   ├── providers/          # AI Provider 保持现有可插拔架构
│   │   └── ai.schema.ts
│   ├── credits/
│   ├── follows/
│   └── users/
├── middleware/
│   ├── auth.ts           # requireAuth, optionalAuth
│   ├── errorHandler.ts   # 全局错误处理
│   └── validate.ts       # Zod 校验中间件
└── shared/
    ├── errors.ts         # 自定义错误类（NotFound, Forbidden, etc.）
    └── types.ts          # 共享类型
```

### 5.2 三层职责

| 层 | 职责 | 可测试性 |
|----|------|---------|
| **Routes** | HTTP 解析、Zod 校验、调用 Service、返回响应 | Supertest 集成测试 |
| **Service** | 业务逻辑编排、事务管理、权限检查 | 纯函数单元测试（mock Repository） |
| **Repository** | 数据库 CRUD、SQL 查询 | 数据库集成测试（测试 DB 实例） |

### 5.3 示例：Works 模块

```typescript
// works.schema.ts — Zod 校验
export const createWorkSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['comic', 'drama', 'novel']).default('comic'),
  cover_image: z.string().url().optional(),
  allow_fork: z.boolean().default(true),
  pages: z.array(pageSchema).optional(),
})

// works.repository.ts — 数据访问
export class WorksRepository {
  constructor(private db: DrizzleInstance) {}

  async findById(id: string) {
    return this.db.query.works.findFirst({ where: eq(works.id, id) })
  }

  async create(data: NewWork) {
    return this.db.insert(works).values(data).returning()
  }
  // ...
}

// works.service.ts — 业务逻辑
export class WorksService {
  constructor(
    private worksRepo: WorksRepository,
    private contributorsRepo: ContributorsRepository,
  ) {}

  async createWork(userId: string, input: CreateWorkInput) {
    // 事务：创建作品 → 设置 root → 添加贡献者 → 插入页面
    return this.db.transaction(async (tx) => { ... })
  }
}

// works.routes.ts — 路由
router.post('/works',
  requireAuth,
  validate(createWorkSchema),
  async (req, res, next) => {
    const work = await worksService.createWork(req.userId!, req.body)
    res.status(201).json(work)
  }
)
```

---

## 六、TDD 实施策略

### 6.1 测试金字塔

```
        /  E2E 测试  \          ← 少量，关键用户流程
       /  集成测试     \         ← API 路由 + 真实数据库
      /  单元测试       \        ← Service 层业务逻辑
     /__________________\
```

### 6.2 测试分类

| 类型 | 工具 | 覆盖范围 | 数量占比 |
|------|------|---------|---------|
| **单元测试** | Vitest | Service 层纯逻辑（权限检查、积分计算、fork 逻辑） | 60% |
| **集成测试** | Vitest + 测试 PostgreSQL | Repository 层（真实 DB 读写）+ Routes（Supertest） | 30% |
| **E2E 测试** | 手动 / 未来补充 | 关键用户流程（注册→创作→发布→评论） | 10% |

### 6.3 测试基础设施

```typescript
// test/setup.ts — 每个测试文件独立的测试数据库
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// 每次测试创建独立的 schema，测试结束清理
export async function createTestDb() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  return { db, pool, cleanup: () => pool.end() }
}
```

### 6.4 TDD 工作流

```
1. 写一个失败的测试（描述期望行为）
2. 运行测试 → 红灯
3. 写最小实现代码使测试通过
4. 运行测试 → 绿灯
5. 重构代码（不改变行为）
6. 运行测试 → 依然绿灯
7. 提交
```

---

## 七、分阶段执行计划

### 阶段 0：基础设施准备（1-2 天）

**目标：** 搭建测试和开发基础设施

- [ ] 安装依赖：`pg`、`drizzle-orm`、`drizzle-kit`、`zod`、`vitest`、`supertest`
- [ ] 配置 Vitest
- [ ] 配置 Drizzle + PostgreSQL 连接
- [ ] 编写 Drizzle schema（对应第四节的 SQL）
- [ ] 生成初始迁移
- [ ] 配置环境变量（DATABASE_URL 等）
- [ ] 全局错误处理中间件
- [ ] Zod 校验中间件

**验证：** `vitest run` 通过（即使没有测试），`drizzle-kit push` 能建表

### 阶段 1：用户模块 + 认证（TDD 驱动）（2-3 天）

**目标：** 最独立的模块，建立 TDD 模式标杆

- [ ] `users/repository` + 测试
- [ ] `users/service` + 测试
- [ ] `auth/repository` + 测试
- [ ] `auth/service`（注册、登录、JWT）+ 测试
- [ ] `auth/routes` + Supertest 集成测试
- [ ] Zod 校验 schema
- [ ] 数据迁移脚本（SQLite → PostgreSQL，用户数据）

**验证：** 所有用户/认证 API 测试通过，Postman 可调通

### 阶段 2：作品模块（核心，最复杂）（3-4 天）

- [ ] `works/repository` + 测试
- [ ] `works/service`（CRUD + fork + 贡献者继承 + 创作树）+ 测试
- [ ] `works/routes` + 集成测试
- [ ] `contributors/repository` + 测试
- [ ] 数据迁移（works、work_pages、contributors）

**验证：** 作品 CRUD、fork、创作树 API 全部测试通过

### 阶段 3：社交模块（2 天）

- [ ] `follows` 模块（Repository → Service → Routes → 测试）
- [ ] `comments` 模块（含嵌套回复）
- [ ] `work_likes` / `page_likes` 模块
- [ ] `subscriptions` 模块
- [ ] 数据迁移

### 阶段 4：阅读模块（1-2 天）

- [ ] `bookmarks` 模块
- [ ] 阅读进度追踪逻辑
- [ ] 数据迁移

### 阶段 5：消息模块（2 天）

- [ ] `conversations` / `messages` 模块
- [ ] 系统通知逻辑（从路由中抽离为 Service）
- [ ] 数据迁移

### 阶段 6：AI 模块（2-3 天）

- [ ] `ai/repository`（任务 CRUD）+ 测试
- [ ] `ai/service`（生成编排、积分扣除、取消逻辑）+ 测试
- [ ] AI Provider 接口保持不变，抽离为独立目录
- [ ] `credits` 模块（签到、流水）+ 测试
- [ ] `ai/routes` 重写为薄层
- [ ] 数据迁移

### 阶段 7：前端适配 + 收尾（2-3 天）

- [ ] 前端 API 层适配（ID 从 number 改为 string/UUID）
- [ ] ESLint + Prettier 配置
- [ ] CI 配置（GitHub Actions：lint + test）
- [ ] Docker Compose（PostgreSQL + App）
- [ ] 更新 CLAUDE.md

---

## 八、数据迁移策略

**已确认从零开始**，不需要 SQLite → PostgreSQL 数据迁移。重写 seed 脚本填充演示数据即可。

---

## 九、风险和注意事项

| 风险 | 应对 |
|------|------|
| 前端大量硬编码 number 类型 ID | 全局搜索 `number` 类型定义，统一改为 `string` |
| SQLite 的 datetime 格式与 PG 不同 | 统一用 ISO 8601，Drizzle 自动处理 |
| 迁移过程中服务不可用 | 分阶段迁移，双写过渡或维护窗口 |
| 测试覆盖不全导致回归 | 先覆盖核心路径（用户、作品、fork），再补充 |

---

## 十、已确认决策

### 核心决策

| 讨论点 | 决策 | 说明 |
|--------|------|------|
| PostgreSQL 部署 | 本地 Docker | docker-compose 一键启动，开发环境与生产一致 |
| UUID 策略 | UUID v4 随机 | 前端 ID 类型从 number 统一改为 string |
| 数据迁移 | 从零开始 | 当前仅有演示数据，重写 seed 脚本即可 |
| 阶段顺序 | 按计划顺序 | Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 |
| 前端时机 | 后端完成后再统一改 | 集中处理 ID 变更和 API 适配，避免频繁切换 |

### 实现细节

| 细节 | 决策 | 说明 |
|------|------|------|
| 后端运行方式 | 继续用 tsx | 和现在一样，不增加编译步骤 |
| API 版本号 | 不加 /v1 | 当前只有一个版本，等真正需要 v2 时再加 |
| 图片存储 | 先本地磁盘 | 文件名设计要便于后续迁移到 OSS（如 `{type}/{date}/{uuid}.{ext}`） |
| seed 数据规模 | 保持现有规模 | 5 个用户 + 7 个作品 |
| 系统通知 | conversation_type 加 `system` | 每个用户自动拥有 system 类型会话，sender_id 为 NULL 表示系统发送，去掉 id=0 假用户 |

| 讨论点 | 决策 | 说明 |
|--------|------|------|
| PostgreSQL 部署 | 本地 Docker | docker-compose 一键启动，开发环境与生产一致 |
| UUID 策略 | UUID v4 随机 | 前端 ID 类型从 number 统一改为 string |
| 数据迁移 | 从零开始 | 当前仅有演示数据，无需迁移，重写 seed 脚本即可 |
| 阶段顺序 | 按计划顺序 | Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 |
| 前端时机 | 后端完成后再统一改 | 集中处理 ID 变更和 API 适配，避免频繁切换 |

---

*文档版本：v1.0*
*创建日期：2026-05-17*
