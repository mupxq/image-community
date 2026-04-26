# 影像社区

AI 驱动的协作创作社区平台，支持漫画和短剧的创作、续写、收藏和协作交流。

## 功能

- **作品发现** — 浏览漫画和短剧，按类型筛选
- **创作系统** — 手动创作 + AI 辅助创作（6种风格）
- **故事分叉** — 基于已有作品续写新分支，形成创作树
- **贡献溯源** — 自动追踪上游创作者，记录共创关系链
- **书架管理** — 收藏作品，追踪阅读状态和进度
- **消息系统** — 私聊和群聊，支持作品关联的共创群
- **创作树可视化** — 展示作品的所有分支和演变路径

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express 5 + TypeScript |
| 数据库 | SQLite (better-sqlite3, WAL 模式) |
| 前端 | React + TypeScript + Vite |
| 样式 | Tailwind CSS v4 (暗色主题) |
| 状态管理 | React Context + Hooks |
| 路由 | React Router (HashRouter) |

## 快速开始

需要 Node.js 18+。

```bash
# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../client && npm install

# 启动后端（端口 3000）
cd ../backend && npm start

# 启动前端（端口 5173，自动代理 API 到后端）
cd ../client && npm run dev
```

打开 http://localhost:5173 即可访问。首次启动会自动创建数据库并填充演示数据（5 个用户、7 个作品）。

## 项目结构

```
image-community/
├── backend/              # 后端 API 服务
│   ├── src/
│   │   ├── index.ts        # Express 入口
│   │   ├── routes.ts       # 22 个 REST API 路由
│   │   ├── database.ts     # SQLite 表结构定义
│   │   └── seed.ts         # 演示数据填充
│   ├── public/             # 静态资源
│   └── data.db             # SQLite 数据库文件
├── client/               # 前端 React 应用
│   ├── src/
│   │   ├── api/            # API 调用封装
│   │   ├── contexts/       # 用户状态管理
│   │   ├── components/     # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── types.ts        # TypeScript 类型定义
│   │   └── App.tsx         # 路由配置
│   └── index.html
└── .gitignore
```

## 数据库

SQLite，8 张表：`users`、`works`、`work_pages`、`contributors`、`comments`、`bookmarks`、`conversations`、`messages`、`conversation_members`。

核心关系：
- 作品通过 `parent_work_id` / `root_work_id` 形成树形分叉结构
- `contributors` 表追踪直接创作者和上游祖先链
- `bookmarks` 追踪阅读状态（想读、在读、已读完）和阅读进度

重置数据：删除 `backend/data.db` 后重启后端即可。

## API

所有接口前缀 `/api`：

| 路径 | 说明 |
|---|---|
| `GET /api/works` | 作品列表（支持 type/sort 筛选） |
| `GET/POST /api/works/:id` | 作品详情 / 创建 |
| `POST /api/works/:id/fork` | 续写（分叉） |
| `GET /api/works/:id/tree` | 创作树 |
| `GET/POST /api/works/:id/comments` | 评论 |
| `GET/POST/PUT/DELETE /api/bookmarks` | 书架管理 |
| `GET /api/users/:id/conversations` | 会话列表 |
| `GET/POST /api/conversations/:id/messages` | 消息收发 |

## 注意事项

- 当前为 Demo 模式，无用户认证，通过前端切换用户身份
- AI 创作功能为模拟实现，生成固定模板内容
- 图片上传功能尚未接入
