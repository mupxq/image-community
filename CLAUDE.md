# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoCoNut — AI-powered collaborative creation community platform. Users create works (comics/dramas), fork/branch storylines via a tree structure, track reading progress, and collaborate through messaging. Supports both manual creation and AI-assisted generation via multiple providers (OpenAI, Volcengine/Doubao).

## Commands

```bash
# Backend (Express 5 on port 3000, runs via tsx — no compile step)
cd backend && npm start

# Run tests (Vitest, requires Docker PostgreSQL running)
cd backend && npm test

# Run single test file
cd backend && npx vitest run src/test/modules/users.repository.test.ts

# Lint & format
cd backend && npm run lint
cd backend && npm run format

# Database migrations
cd backend && npm run db:generate   # Generate migration from schema changes
cd backend && npm run db:migrate    # Apply migrations
cd backend && npm run db:push       # Push schema directly (dev only)

# Frontend (Vite dev server on port 5173, proxies /api and /uploads to backend)
cd client && npm run dev

# Production build
cd client && npm run build

# Production deployment (PM2)
pm2 start ecosystem.config.js
```

## Architecture

Two independent projects at repo root:

```
image-community/
├── backend/               # Express 5 + PostgreSQL (Drizzle ORM, TypeScript)
│   ├── src/
│   │   ├── index.ts       # Express entry, DI wiring, middleware, static serving
│   │   ├── config.ts      # Centralized env vars (DATABASE_URL, JWT_SECRET, etc.)
│   │   ├── seed.ts        # Demo data (5 users, 7 works with creation trees)
│   │   ├── db/            # Database layer
│   │   │   ├── schema.ts  # Drizzle schema (17 tables, 9 enums, UUID PKs)
│   │   │   ├── client.ts  # Drizzle + pg Pool (auto-selects test DB)
│   │   │   └── migrations/
│   │   ├── middleware/     # Express middleware
│   │   │   ├── auth.ts    # JWT auth (requireAuth, optionalAuth, generateToken)
│   │   │   ├── validate.ts # Zod schema validation
│   │   │   ├── errorHandler.ts # Global error handler (AppError subclasses)
│   │   │   └── serialize.ts   # camelCase → snake_case response serializer
│   │   ├── shared/
│   │   │   └── errors.ts  # AppError hierarchy (NotFound, Forbidden, etc.)
│   │   ├── modules/       # Feature modules (Route → Service → Repository)
│   │   │   ├── auth/      # Registration, login, JWT token management
│   │   │   ├── users/     # User profiles, avatar upload
│   │   │   ├── works/     # Works CRUD, fork, tree, pages, contributors
│   │   │   ├── social/    # Follows, comments, likes, subscriptions (unified)
│   │   │   ├── bookmarks/ # Reading list management
│   │   │   ├── messaging/ # Conversations, messages, system notifications
│   │   │   ├── credits/   # Daily check-in, credit tracking
│   │   │   ├── ai/        # AI generation, task management, config
│   │   │   └── ...        # follows/, comments/, likes/, subscriptions/ (repos)
│   │   ├── ai/            # AI provider system (pluggable, DB-independent)
│   │   │   ├── providers/ # mock, openai, volcengine
│   │   │   ├── registry.ts # Provider registry
│   │   │   ├── prompts.ts # Prompt engineering
│   │   │   └── storage.ts # Image download & save
│   │   └── test/          # All test files (Vitest + Supertest)
│   │       ├── setup.ts   # createTestDb helper (coconut_test DB)
│   │       └── modules/   # Per-module test files
│   ├── drizzle.config.ts  # Drizzle Kit config
│   └── vitest.config.ts   # fileParallelism: false (shared test DB)
├── client/                # React 19 + TypeScript (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── api/index.ts   # All backend API calls (12 modules, string UUID IDs)
│   │   ├── contexts/      # UserContext (JWT auth state)
│   │   ├── components/    # Reusable UI (12 components)
│   │   ├── pages/         # 14 page components
│   │   ├── types.ts       # Shared TypeScript interfaces (string IDs)
│   │   ├── App.tsx        # HashRouter routes
│   │   └── index.css      # Tailwind v4 + custom dark theme
│   └── vite.config.js     # Proxy /api and /uploads to backend
├── docker-compose.yml     # PostgreSQL 16 Alpine
├── ecosystem.config.js    # PM2 production config
├── PRODUCT.md             # Product requirements doc (Chinese)
└── STACK.md               # Full technology stack and dependency analysis
```

Backend runs via `tsx` (no pre-compile). Frontend uses Vite with HMR. State management: React Context + Hooks. Routing: HashRouter.

## Layered Architecture

Each module follows **Route → Service → Repository** pattern with dependency injection:

```
Route (Express handler, validation, auth)
  → Service (business logic, error handling)
    → Repository (Drizzle ORM queries)
```

Routes are created via factory functions: `createWorksRouter(worksService)`. Services are injected into Express in `index.ts`.

## Authentication

JWT-based auth. Backend middleware: `requireAuth` (protected routes), `optionalAuth` (works with/without auth). Frontend stores token in localStorage, sends via `Authorization: Bearer <token>`. API 401 responses trigger automatic logout and redirect to login.

## Database

PostgreSQL 16 via Docker + Drizzle ORM. UUID v4 primary keys. 17 tables, 9 enums:

- **Core:** `users`, `works`, `work_pages`, `contributors`, `comments`
- **Social:** `follows`, `work_likes`, `page_likes`, `subscriptions`
- **Reading:** `bookmarks`, `check_ins`, `credit_logs`
- **Messaging:** `conversations`, `conversation_members`, `messages`
- **AI:** `user_ai_configs`, `generation_tasks`

**Key relationships:**
- Works form a tree via `parent_work_id`/`root_work_id` (forking/continuation model)
- Contributors track direct creators AND ancestor chain (inherited on fork)
- System notifications use conversation_type `system` with sender_id NULL

**Testing:** Tests use `coconut_test` database. `fileParallelism: false` in Vitest config because all tests share the same test DB. `beforeAll` cleanup ensures test isolation.

**Response serialization:** Backend uses camelCase internally (Drizzle), but a middleware auto-converts responses to snake_case for frontend compatibility.

## AI System

Pluggable provider architecture. Each provider implements a common interface for image and text generation. Two modes:
- **Platform mode:** Uses credits (earned via daily check-in: 100/day, 500 every 7th day)
- **Custom mode:** User provides own API keys, no credit deduction

Generation is async — creates a `generation_task` with status tracking (`generating` → `completed`/`failed`/`cancelled`). Supports task regeneration, single-page regeneration, and cover generation.

## TDD Development Workflow

All backend code **must** follow TDD (Test-Driven Development). No exceptions.

### Red-Green-Refactor Cycle

1. **Red** — Write a failing test first. Run it, confirm it fails.
2. **Green** — Write the minimal code to make the test pass. Nothing more.
3. **Refactor** — Clean up while keeping tests green.

### Test Structure & Conventions

```
src/test/
├── setup.ts                    # createTestDb() — shared test DB helper
├── infrastructure.test.ts      # Error classes, shared utilities
└── modules/
    ├── users.repository.test.ts
    ├── auth.service.test.ts
    ├── auth.routes.test.ts
    └── ...
```

- **Test location:** All tests live under `src/test/`, never colocated with source.
- **Test file naming:** `<module>.<repository|service|routes>.test.ts`
- **Test DB:** Uses `coconut_test` database (separate from dev `coconut_dev`). Docker must be running.
- **Parallelism:** `fileParallelism: false` in `vitest.config.ts` — all tests share the same DB instance.

### Test Isolation Rules

Every test file must:

```typescript
// 1. Create test DB in beforeAll
beforeAll(async () => {
  testDb = await createTestDb()
  await testDb.cleanup()  // Clean leftover data from previous files
  // ... set up repos/services
})

// 2. Clean relevant tables in beforeEach (NOT beforeAll)
beforeEach(async () => {
  await testDb.db.delete(someTable)
  await testDb.db.delete(anotherTable)
})

// 3. Close pool in afterAll
afterAll(async () => { await testDb.teardown() })
```

**Why `beforeAll` cleanup + `beforeEach` isolation:** Previous test files only call `teardown()` in `afterAll` (closes pool) without cleanup. The NEXT file's `beforeAll` must clean up stale data.

### Testing by Layer

**Repository tests** — Test raw DB operations directly:
```typescript
it('should create and retrieve', async () => {
  const created = await repo.create({ ... })
  const found = await repo.findById(created.id)
  expect(found).toBeTruthy()
})
```

**Service tests** — Test business logic with real repos (integration, not mocks):
```typescript
it('should reject duplicate check-in', async () => {
  await service.checkIn(userId)
  await expect(service.checkIn(userId)).rejects.toThrow('今日已签到')
})
```

**Route tests** — Test HTTP layer via Supertest, full middleware stack:
```typescript
const app = express()
app.use(express.json())
app.use('/api', createAuthRouter(authService))
const res = await request(app).post('/api/auth/register').send({ ... })
expect(res.status).toBe(201)
```

### Adding a New Feature

Follow this exact order:

1. Add schema to `src/db/schema.ts` if new tables needed → `npm run db:generate && npm run db:migrate`
2. Write **repository tests** → implement repository
3. Write **service tests** → implement service
4. Write **route tests** → implement routes
5. Wire into `src/index.ts` (DI)
6. Run `npm test` — all tests must pass

### Key Rules

- **Never skip tests.** If a feature doesn't have tests, it doesn't exist.
- **No mocks for repositories.** Use the real test database. Mock/prod divergence is unacceptable.
- **Test error paths too.** NotFound, Forbidden, Validation, Conflict — every error branch needs a test.
- **One assertion per concept.** Multiple `expect()` in one test is fine, but test one behavior at a time.
- **Run `npm test` before declaring work done.** All 179+ tests must pass.

## Naming Conventions

- **Database columns:** snake_case (`parent_work_id`, `created_at`)
- **Drizzle schema:** camelCase JS properties (`parentWorkId`, `createdAt`)
- **Frontend API responses:** snake_case (auto-serialized from camelCase)
- **Frontend variables:** camelCase, PascalCase components
- **TypeScript interfaces:** PascalCase (`WorkDetail`, `AuthUser`)
- **All IDs:** string UUID (not number)
