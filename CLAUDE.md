# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered collaborative storytelling community platform for comics and dramas. Users create works, fork/branch storylines, track reading progress, and collaborate via messaging.

## Commands

**Backend:**
- `cd backend && npm start` — Start Express server on port 3000 (runs via tsx)

**Frontend:**
- `cd client && npm run dev` — Start Vite dev server on port 5173 (proxies `/api` to backend)
- `cd client && npm run build` — Production build to `client/dist/`

No test framework or linter configured for either project.

## Architecture

Two independent projects at the repo root:

```
image-community/
├── backend/          # Express + SQLite API server (TypeScript)
│   ├── src/
│   │   ├── index.ts    # Express entry, middleware, static serving
│   │   ├── routes.ts   # All API route handlers (22 REST endpoints)
│   │   ├── database.ts # SQLite schema (better-sqlite3, WAL mode)
│   │   └── seed.ts     # Demo data (5 users, 7 works)
│   ├── public/         # Static assets, uploads dir
│   ├── data.db         # SQLite database
│   └── package.json
├── client/           # React + TypeScript frontend (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/        # API client (all backend calls)
│   │   ├── contexts/   # React Context (UserContext)
│   │   ├── components/ # Reusable UI (TabBar, WorkCard, PagesEditor, etc.)
│   │   ├── pages/      # 9 page components (Home, WorkDetail, Create, etc.)
│   │   ├── types.ts    # Shared TypeScript interfaces
│   │   └── App.tsx     # HashRouter routes
│   └── package.json
├── .gitignore
└── CLAUDE.md
```

Both projects are fully TypeScript. Backend runs via `tsx` (no pre-compile). Frontend uses Vite with HMR.

State management: React Context + Hooks. Routing: react-router-dom (HashRouter). Styling: Tailwind CSS v4 with custom dark theme colors.

## Database

SQLite via better-sqlite3 (synchronous API). 8 tables: `users`, `works`, `work_pages`, `contributors`, `comments`, `bookmarks`, `conversations`, `messages`, plus `conversation_members`.

Key relationships:
- Works form a tree via `parent_work_id` / `root_work_id` (forking/continuation model)
- Contributors track both direct creators and ancestors for credit chains
- Bookmarks track reading status (`want_read`, `reading`, `finished`) with progress

To reset data: delete `backend/data.db` and restart the server (seed runs automatically).

## API Structure

All endpoints prefixed with `/api`:
- `/api/users` — user CRUD, works, contributions
- `/api/works` — CRUD, filtering (type/sort), forking, pages, creation tree
- `/api/works/:id/comments` — comments
- `/api/users/:id/bookmarks` and `/api/bookmarks` — bookshelf management
- `/api/users/:id/conversations` and `/api/conversations/:id/messages` — messaging

## Key Design Decisions

- **No authentication** — demo mode with user-switching UI (switches between 5 seeded users)
- **AI generation is mocked** — Create page has AI mode with style selection but generates placeholder content from templates
- **Image uploads not implemented** — multer is a dependency but upload routes are not wired up
- **No environment config** — port, API base URL, and DB path are hardcoded
