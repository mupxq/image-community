# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoCoNut — AI-powered collaborative creation community platform. Users create works (comics/dramas), fork/branch storylines via a tree structure, track reading progress, and collaborate through messaging. Supports both manual creation and AI-assisted generation via multiple providers (OpenAI, Volcengine/Doubao).

## Commands

```bash
# Backend (Express on port 3000, runs via tsx — no compile step)
cd backend && npm start

# Frontend (Vite dev server on port 5173, proxies /api and /uploads to backend)
cd client && npm run dev

# Production build
cd client && npm run build

# Production deployment (PM2)
pm2 start ecosystem.config.js
```

No test framework or linter configured for backend. Frontend has `npm run lint` (ESLint).

## Architecture

Two independent projects at repo root:

```
image-community/
├── backend/               # Express 5 + SQLite API server (TypeScript)
│   ├── src/
│   │   ├── index.ts       # Express entry, middleware, static serving, backup scheduling
│   │   ├── routes.ts      # Core API routes (works, users, comments, bookmarks, etc.)
│   │   ├── authRoutes.ts  # Auth endpoints (register, login, /auth/me)
│   │   ├── aiRoutes.ts    # AI generation, task management, config
│   │   ├── uploadRoutes.ts# Image upload (multer, 10MB limit)
│   │   ├── creditsRoutes.ts # Credits system, daily check-in
│   │   ├── database.ts    # SQLite schema (17 tables, WAL mode, migration system)
│   │   ├── seed.ts        # Demo data (5 users password 123456, 7 works)
│   │   └── ai/            # AI provider system (pluggable architecture)
│   │       ├── index.ts       # AI system entry
│   │       ├── provider.ts    # Base provider interface
│   │       ├── registry.ts    # Provider registry
│   │       ├── prompts.ts     # Prompt engineering
│   │       ├── storage.ts     # Image storage handling
│   │       ├── mock.ts        # Mock provider
│   │       ├── openai.ts      # OpenAI integration
│   │       └── volcengine.ts  # Volcengine/Doubao integration
│   ├── public/uploads/    # Uploaded images
│   └── data.db            # SQLite database
├── client/                # React 19 + TypeScript (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── api/index.ts   # All backend API calls (12 modules)
│   │   ├── contexts/      # UserContext (JWT auth state)
│   │   ├── components/    # Reusable UI (12 components)
│   │   ├── pages/         # 14 page components
│   │   ├── types.ts       # Shared TypeScript interfaces
│   │   ├── App.tsx        # HashRouter routes
│   │   └── index.css      # Tailwind v4 + custom dark theme
│   └── vite.config.js     # Proxy /api and /uploads to backend
├── ecosystem.config.js    # PM2 production config
├── PRODUCT.md             # Product requirements doc (Chinese)
└── STACK.md               # Full technology stack and dependency analysis
```

Backend runs via `tsx` (no pre-compile). Frontend uses Vite with HMR. State management: React Context + Hooks. Routing: HashRouter.

## Authentication

JWT-based auth. Backend middleware: `requireAuth` (protected routes), `optionalAuth` (works with/without auth). Frontend stores token in localStorage, sends via `Authorization: Bearer <token>`. API 401 responses trigger automatic logout and redirect to login.

## Database

SQLite via better-sqlite3 (synchronous, prepared statements, WAL mode). 17 tables:

- **Core:** `users`, `works`, `work_pages`, `contributors`, `comments` (with nested replies via `parent_id`)
- **Social:** `follows`, `work_likes`, `page_likes`, `subscriptions`
- **Reading:** `bookmarks` (status: `want_read`/`reading`/`finished` with progress tracking)
- **Messaging:** `conversations`, `conversation_members`, `messages` (supports text/image/work_share/system types)
- **AI:** `user_ai_configs`, `generation_tasks` (async task queue with status tracking), `credit_logs`, `check_ins`

**Key relationships:**
- Works form a tree via `parent_work_id`/`root_work_id` (forking/continuation model)
- Contributors track direct creators AND ancestor chain (inherited on fork)
- System notifications sent via special conversations (`sender_id = 0`) with JSON-structured content

**Migration:** Schema changes applied via ALTER TABLE checks on startup. Reset data: delete `backend/data.db` and restart.

## AI System

Pluggable provider architecture. Each provider implements a common interface for image and text generation. Two modes:
- **Platform mode:** Uses credits (earned via daily check-in: 100/day, 500 every 7th day)
- **Custom mode:** User provides own API keys, no credit deduction

Generation is async — creates a `generation_task` with status tracking (`generating` → `completed`/`failed`/`cancelled`). Supports task regeneration, single-page regeneration, and cover generation.

## API Structure

All endpoints prefixed with `/api`:

| Group | Prefix | Key Operations |
|-------|--------|----------------|
| Auth | `/auth` | register, login, me |
| Users | `/users` | CRUD, avatar upload, follow/unfollow, followers/following |
| Works | `/works` | CRUD, filtering (type/sort), fork, tree, pages, like, branches |
| Pages | `/pages` | like/unlike |
| Comments | `/works/:id/comments`, `/comments/:id` | CRUD with replies and @mentions |
| Bookmarks | `/bookmarks`, `/users/:id/bookmarks` | CRUD, status/progress, check |
| Subscriptions | `/subscriptions` | subscribe/unsubscribe, mark viewed |
| Conversations | `/conversations` | create, list, messages |
| AI | `/ai` | generate, providers, tasks CRUD, config, cover/page generation |
| Credits | `/credits` | status, check-in, logs |
| Upload | `/upload` | image upload |

## Frontend Design System

Dark theme with Tailwind CSS v4. Custom colors defined in `index.css`:
- Primary: `#6C5CE7` (purple), Accent: `#00D2FF` (cyan) and `#FF6B9D` (pink)
- Background: `#0F0F1A`, Card: `#1A1A2E`, Border: `#2A2A3E`
- Mobile-first layout: max-width 430px centered. Desktop: full-width with 200px sidebar.

## Naming Conventions

- **Database:** snake_case (`parent_work_id`, `created_at`)
- **Frontend:** camelCase variables, PascalCase components
- **TypeScript interfaces:** PascalCase (`WorkDetail`, `AuthUser`)
