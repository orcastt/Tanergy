# TANGENT

**Web Collaborative AI Visual Canvas · Direction Reset**

> **Pivot Notice — 2026-04-29**
> 当前项目方向已从「Tauri 桌面客户端 + 公众号复杂工作流」切换到「Web-first 多人协作 AI 视觉画布」。旧桌面代码和文档保留为 legacy/frozen，不再作为新功能默认承载层。
>
> 新入口：`project_state.md` → `PRD.web-collab.md` → `ARCH.web-collab.md` → `dev-plans/web-collaborative-canvas-pivot.md`。

---

## 当前方向

TANGENT 新版本目标是一个面向海外团队的 Web 协作 AI 画布：用户可以像 Miro/FigJam 一样多人同时涂写、贴图、连线，并用最简单的 Prompt / Generate Image / Edit Image 节点完成生图和改图。

以下旧说明保留用于回溯历史实现，不代表当前新开发范围。

## 什么是 TANGENT？

TANGENT 是一款**桌面应用（Tauri v2）**，通过节点画布帮助内容创作者完成从「主题」到「可发布公众号图文」的完整 AI 生产流水线。用户拖拽节点、连接模型，AI 自动完成调研、大纲、配图、排版。

TANGENT is a **desktop application (Tauri v2)** — a node-based AI canvas that takes a topic all the way to a publish-ready WeChat article. Drag nodes, connect them, and let AI handle research, outline, images, and HTML formatting.

---

## 核心功能 · Key Features

| 功能 | 说明 |
|------|------|
| 🎨 节点画布 | 拖拽节点、连线、网格对齐，React Flow 引擎 |
| 🤖 AI 对话面板 | 右侧 AI 面板自然语言描述需求，自动生成节点拓扑 |
| 📝 公众号图文 Skill | text_input → research → outline → image → Html Editor 完整链路，支持多套公众号主题 |
| 🗂️ 个人素材库 | 全局文章/图片素材库，支持标签、搜索、拖拽回画布和 Knowledge Graph |
| 📚 Writer 书稿编辑器 | 高级节点，用于长文/小说/书稿，纯文本编辑 + 书籍式预览 |
| 🖼️ 图层图片编辑器 | Procreate 风格多图层编辑器（画笔/选择/AI Edit/栅格化） |
| 🌍 中英双语 | 一键切换中文/英文界面 |
| 🌙 暗色/亮色主题 | 顶栏一键切换 |
| 💳 积分订阅系统 | Free 50 积分起步；Pro 月付/年付，按积分使用 AI |
| 🔐 Email OTP 登录 | 注册即用，AI 调用统一走官方后端代理 |
| 🧭 官方 Provider 线路 | Provider Key、模型价格、备用线路统一在 Admin 管理 |

当前开发入口：`project_state.md` → `dev-plans/admin-provider-model-management-p0.md`。

---

## 当前节点清单（公众号主流程）

### 默认主流程节点

| 节点 | 类型 | 说明 |
|------|------|------|
| `text_input` | 输入 | 用户输入主题/关键词；支持接收上游节点文本 |
| `research` | AI | Tavily 多轮搜索，整合背景素材 |
| `outline_generator` | AI | 生成章节大纲 + image_plans，驱动 Split |
| `image_list` | AI | 多模型图片生成，双输入，动态输出端口，内置图层编辑器 |
| `image_asset` | 图片 | 个人图片素材容器，可缩放，双击进入 Image Editor |
| `html_formatter` / Html Editor | 输出 | Markdown + 图片 → 微信样式 HTML；双击进入富文本编辑、微信预览、AI 改写、多主题输出 |

可选节点：`image_planner`、`image_gallery`、`writer`。

### 遗留节点（非默认）

`gate`、`reviewer`、`image_gen`、`preview_wechat` — 不进入默认模板。

---

## 技术栈 · Tech Stack

### 桌面客户端

| 层级 | 选型 |
|------|------|
| 桌面壳 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript 6 + Vite 8 |
| 画布 | React Flow v12 |
| 状态管理 | Zustand v5 |
| UI | Tailwind CSS + Radix UI |
| 本地数据库 | SQLite（Rust 侧管理） |
| API Key 加密 | AES-256-GCM（legacy，本地 BYOK 当前关闭） |
| 多语言 | i18next + react-i18next |

### 后端服务（Phase 2）

| 层级 | 选型 |
|------|------|
| API 框架 | FastAPI (Python) |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 支付 | Stripe Checkout + Webhook |
| 认证 | Email OTP + JWT |
| AI 代理 | httpx 多 provider 路由（minimax / claude / gpt / gemini / glm / geekai） |
| 部署 | Docker Compose + Nginx |

### 管理后台

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16 + App Router |
| UI | shadcn/ui + TailwindCSS |

---

## 商业模式 · Business Model

| 套餐 | 价格 | 积分 | 说明 |
|------|------|------|------|
| Free | $0 | 50（注册赠送） | 官方 API 代理，按积分扣费 |
| Pro Monthly | $9.99/月 | 500 积分/月 | 8 折购积分 |
| Pro Yearly | $79.99/年 | 6000 积分/年 | 最佳价值 |

当前产品路线为官方后端代理优先；用户自带 API Key / BYOK 暂不开放，后续如需要再作为高级模式恢复。

---

## 快速开始 · Getting Started

### 环境要求

- [Rust](https://rustup.rs/) 1.75+
- Node.js 20+
- Python 3.11+（仅后端）

### 本地开发（桌面客户端）

```bash
# Clone
git clone https://github.com/chuhengtantt/TangentAgent.git
cd TangentAgent

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动 Tauri 开发模式（同时启动前端 Vite + Tauri Rust）
cargo tauri dev
```

### 开发规范与验证

完整规范见 [dev-plans/code-quality-standards.md](dev-plans/code-quality-standards.md)。

```bash
# 前端构建
npm -C frontend run build

# Rust / Tauri 检查
cargo check --manifest-path src-tauri/Cargo.toml

# 对触碰文件做定向 lint（从 frontend/ 目录执行）
cd frontend
npx eslint src/path/to/changed-file.tsx
```

当前策略：全量 `npm -C frontend run lint` 仍有历史债，不作为每次提交阻断；但所有触碰文件必须定向 lint 通过，且禁止新增 `any`、Hook 顺序错误、effect 同步镜像 state 等问题。

### 启动后端服务（Phase 2 积分 / 登录功能需要）

```bash
cd backend
cp .env.example .env   # 填入官方 Provider Keys + Stripe Key

docker compose up -d   # 启动 PostgreSQL + Redis
uvicorn app.main:app --reload --port 8000
```

### 环境变量（后端 `.env`）

```
# AI Providers（官方代理用）
ANTHROPIC_API_KEY=
MINIMAX_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Auth
JWT_SECRET=

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

---

## 项目结构 · Project Structure

```
TanvasAgent/
├── frontend/               ← React + Tauri 前端
│   └── src/
│       ├── pages/          ← WelcomePage / DashboardPage / CanvasPage / SettingsPage
│       ├── nodes/          ← 节点组件（TextInputNode / ImageListNode / ...）
│       │   └── image/      ← Image Editor（图层画板）+ Html Editor
│       ├── canvas/         ← React Flow 画布 + OverlayLayer + DeletableEdge
│       ├── store/          ← Zustand stores（canvas / workflow / auth / credits）
│       ├── agent/          ← AI Agent 面板（对话 + nodeBuilder）
│       └── services/       ← Tauri IPC 封装
├── src-tauri/              ← Rust 后端（Tauri IPC 命令）
│   └── src/commands/       ← execute / workflow / asset / agent / billing
├── backend/                ← Phase 2 FastAPI 后端
│   └── app/
│       ├── api/v1/         ← auth / credits / proxy / billing / admin
│       └── services/proxy/ ← 多 provider AI 路由、模型校验、积分日志
├── admin/                  ← 管理后台（Next.js，基础前端已实现，待联调）
├── dev-plans/              ← Slice 开发计划文档
├── debug-plans/            ← Bug 修复记录
├── PRD.md                  ← 产品需求文档
├── ARCH.md                 ← 架构决策文档
└── project_state.md        ← 当前项目状态（AI 必读）
```

---

## 开发路线图 · Roadmap

### Phase 1 — Desktop MVP ✅ 已全部完成

- [x] Tauri 脚手架 + SQLite 本地存储
- [x] Email OTP 登录 + 官方 API 路由（本地 BYOK legacy 能力当前关闭）
- [x] Dashboard 工作流 CRUD
- [x] React Flow 画布核心（拖拽 / 连线 / 网格 / 框选 / 复制粘贴）
- [x] 公众号 Skill 完整链路（text_input → research → outline → Split → image_list → html_formatter / Html Editor）
- [x] Image List 多模型图片生成（动态端口 / 双输入）
- [x] 积分订阅系统（FastAPI + Stripe Checkout）
- [x] 暗色/亮色主题 + 中英切换（i18n）
- [x] 桌面安装包打包（.dmg / .msi）
- [x] 画布交互增强（打组 / 右键菜单 / DeletableEdge）
- [x] AI Agent 对话面板（自然语言自动连线）

### Phase 2 — 商业化 🔄 核心完成，联调与部署收口中

- [x] Skill 动态拓扑系统（Slice 13）
- [x] 模型注册表 + 多模型路由（Slice 14）
- [x] 官方 API 默认路由 + 登录门控（Slice 15）
- [x] Official-only routing 初版收口（BYOK UI/Fallback 暂停）
- [x] 多模型代理 + 差异积分（Slice 16，GeekAI 文本、`gpt-image-2`、Gemini Chat Image 同步直连已通过；GPT/Gemini 最低成本测试参数已拆分，失败退款已验收）
- [x] i18n 完整覆盖（Slice 17，100+ key）
- [x] 首次引导 + Stripe 支付（Slice 18）
- [x] Settings 简化 + Skill 推荐卡片（Slice 19）
- [x] Image Editor 图层画板（Slice 22，Procreate 风格）
- [x] 个人素材库 MVP（文章/图片素材、标签、拖拽到画布、Image 容器；`image_list` 生成图自动入库）
- [x] 素材库 Knowledge Graph（Workspace Library 支持 Gallery/List/Graph）
- [x] Writer 高级节点（书稿编辑器 + PDF/书籍式预览）
- [ ] 管理后台联调验收（Admin API + 基础 Next.js 前端已完成；当前 P0 补 Provider/Model 默认值、fallback、health/test）
- [x] Admin 动态模型源初版（前端模型列表从后端读取，测试默认 `nemotron-3-super-120b-a12b` / 图片默认 `gpt-image-2` / 编辑默认 `gemini-3.1-flash-image-preview`）
- [ ] GeekAI 真 Key 联调（文本已切到 `nemotron-3-super-120b-a12b` 并通过；`image_chat` 已接入且同步直连成功；Tangent 代理闭环、后台模式、图片编辑、异步结果、enhance 待验收）
- [x] Html Editor 富文本编辑（Slice 23，初版完成；支持标准紫/经典蓝/墨黑/暖灰/赭红主题，待手测验收）
- [ ] 线上部署（Docker/Nginx 配置已就绪，待执行）

### Phase 3 — V2

- [ ] 小红书图文笔记 Skill
- [ ] 节点子画布（Draw / Comment / Inpaint）
- [ ] PPT 节点（Reveal.js）
- [ ] 视频节点（Kling、Seedance）
- [ ] 微信公众号直接发布
- [ ] Skill 市场
- [ ] 网页版（云端协同）

---

## License · 许可

Proprietary · 版权所有 © 2026 TANGENT. All rights reserved.
