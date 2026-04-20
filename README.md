# TANVAS

**AI Creative Workflow Canvas · AI 创意工作流画布平台**

---

## What is TANVAS? · 什么是 TANVAS？

**EN** — TANVAS is a node-based AI workflow canvas where you drag, connect, and run AI models to produce images, videos, audio, articles, and presentations — all in one place. Describe what you want in natural language and the AI wires the nodes for you.

**中文** — TANVAS 是一个节点式 AI 工作流画布。你可以拖拽节点、连接模型，自动生成图片、视频、音频、文章和 PPT。用自然语言描述需求，AI 会自动为你连接节点、构建流水线。

---

## Key Features · 核心功能

| Feature · 功能 | Description · 描述 |
|---|---|
| 🎨 Node Canvas · 节点画布 | Drag-and-drop nodes, auto-layout, grid snapping · 拖拽节点，自动布局，网格吸附 |
| 🤖 AI Chat Wiring · AI 自动连线 | Describe a workflow in chat → nodes auto-created and wired · 自然语言描述，自动创建并连接节点 |
| 🖼️ Image Generation · AI 生图 | Midjourney V7, Niji 7, Seedream 5.0, Imagen 3 · 多模型图像生成 |
| 🎬 Video Generation · AI 生视频 | Kling 3.0, Seedance, Vidu, Sora2, Wan2.x |
| 🔊 Audio · 音频 | MiniMax Speech, Tencent Speech, MiniMax Music |
| 📊 PPT Export · PPT 输出 | Reveal.js-based slide generation · 基于 Reveal.js 的幻灯片生成 |
| 📱 Publish · 一键发布 | Xiaohongshu (RED) post + WeChat Official Account article · 小红书图文 + 公众号长文 |
| 🧩 Skills System · 技能系统 | Chain multiple workflows into reusable meta-pipelines · 将多个工作流组合为可复用的技能链 |
| 🔐 Auth · 认证 | Email OTP + Google OAuth |
| 💳 Subscriptions · 订阅 | Stripe — Starter / Pro / Team plans · Stripe 付款，三档订阅 |

---

## Node Categories · 节点分类

**Text · 文本** — Prompt, Note, Optimize, Chat, Storyboard

**Image · 图像 (15+)** — Upload, Camera, Seedream 5.0, Midjourney V7, Niji 7, Generate, Generate 4, Agent, Reference, Analysis, Grid, Split, Compress, View Angle

**Video · 视频 (13)** — Kling, Kling 3.0-Omni, Seedance, Vidu, Sora2 Pro, Sora2 Character, Wan2.6, Wan2 R2V, Wan2.7 I2V, Video Analysis, Frame Extract, Video to GIF

**Audio · 音频 (4)** — MiniMax Speech, Tencent Speech, MiniMax Music, Audio Node

**3D** — 2D to 3D

---

## Tech Stack · 技术栈

| Layer · 层 | Tech |
|---|---|
| Frontend · 前端 | React + TypeScript + React Flow + Zustand + Tailwind |
| Backend · 后端 | FastAPI (Python) + PostgreSQL + Redis |
| AI Orchestration · AI 编排 | Claude API (Function Calling for auto-wiring) |
| Canvas · 画布 | React Flow + Fabric.js (inpainting layer) |
| Real-time collab · 实时协作 | Yjs + WebSocket |
| Storage · 存储 | MinIO (self-hosted, permanent, user-downloadable) |
| Infra · 部署 | Hetzner EU, Docker Compose, GDPR compliant · 欧洲服务器，GDPR 合规 |
| Payment · 支付 | Stripe (EUR) |

---

## Business Model · 商业模式

| Plan · 套餐 | Price · 价格 | Users · 用户数 | Execution · 执行时长 |
|---|---|---|---|
| Starter | €9 / mo | 1 | 5 h / week |
| Pro | €29 / mo | 5 | 20 h / week |
| Team | €79 / mo | 20 | 80 h / week |

Users can publish and share workflows. VIP unlocks premium templates.
用户可发布和分享工作流，VIP 解锁高级模板。

---

## Getting Started · 快速开始

### Prerequisites · 环境要求

- Docker + Docker Compose
- Node.js 20+
- Python 3.11+

### Run locally · 本地运行

```bash
# Clone
git clone https://github.com/your-org/TanvasAgent.git
cd TanvasAgent

# Start all services (backend + DB + Redis)
# 启动所有服务（后端 + 数据库 + Redis）
docker compose up -d

# Install frontend deps and start dev server
# 安装前端依赖并启动开发服务器
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` · 打开浏览器访问 `http://localhost:5173`

> **Dev tip · 开发提示**: OTP verification is auto-filled in development mode — no email required.
> 开发模式下验证码会自动填充，无需真实邮件。

### Environment Variables · 环境变量

Copy `.env.example` to `.env` and fill in your API keys:

```
ANTHROPIC_API_KEY=       # Claude API for AI wiring · Claude 自动连线
MIDJOURNEY_API_KEY=      # Image generation
KLING_API_KEY=           # Video generation
STRIPE_SECRET_KEY=       # Payments · 支付
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
DATABASE_URL=postgresql://...
```

---

## Project Structure · 项目结构

```
TanvasAgent/
├── frontend/               # React app
│   ├── src/
│   │   ├── pages/          # Dashboard, Canvas, Login, Signup
│   │   ├── components/     # TopNav, SideNav, WorkflowCard, …
│   │   ├── nodes/          # Node type definitions
│   │   ├── canvas/         # React Flow canvas setup
│   │   ├── store/          # Zustand stores (workflow, canvas)
│   │   └── services/       # API client
├── backend/                # FastAPI app
│   ├── routers/            # Workflow, Auth, Node endpoints
│   ├── models/             # SQLAlchemy models
│   └── services/           # AI orchestration, storage
├── docker-compose.yml
├── PRD.md                  # Product Requirements · 产品需求文档
└── ARCH.md                 # Architecture · 架构文档
```

---

## Roadmap · 路线图

- [x] Auth (Email OTP + Google OAuth) · 邮箱验证码 + Google 登录
- [x] Dashboard — Workflow CRUD · 工作流管理（增删改查）
- [x] Canvas page scaffold · 画布页面脚手架
- [ ] Node system — drag, connect, run · 节点系统（拖拽、连接、运行）
- [ ] AI Chat → auto-wiring · AI 聊天自动连线
- [ ] Image node (Midjourney, Seedream) · 图像节点
- [ ] Video node (Kling, Wan2) · 视频节点
- [ ] Skills / meta-workflow system · 技能系统
- [ ] Xiaohongshu + WeChat publish · 小红书 + 公众号发布
- [ ] PPT export (Reveal.js) · PPT 导出
- [ ] Real-time collab (Yjs) · 实时协作
- [ ] Subscription + Stripe billing · 订阅付款

---

## License · 许可

Proprietary · 版权所有 © 2026 TANVAS. All rights reserved.
