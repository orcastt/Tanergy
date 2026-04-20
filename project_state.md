# TANGENT — Project State

> AI 每次开始新对话前，先读这个文件了解当前状态。
> 每次 git commit 前更新此文件。

---

## 当前阶段

**阶段**: Phase 1 MVP 开发  
**正在做**: Slice 3 — 画布核心（节点拖拽、连线、执行）

---

## MVP 验收进度

| Slice | 名称 | 状态 | 说明 |
|-------|------|------|------|
| 0 | 项目脚手架 | ✅ 完成 | Docker, FastAPI, Vite, Alembic, PostgreSQL, Redis |
| 1 | 用户系统 | ✅ 完成 | Email OTP + Google OAuth + JWT + 路由守卫 |
| 2 | Dashboard + 工作流 CRUD | ✅ 完成 | 卡片网格、双击重命名、复制、Move to Trash、SideNav 徽章 |
| 2.5 | 画布页脚手架 | ✅ 完成（骨架） | Canvas.tsx / NodePicker / Toolbar / CanvasControls / canvasStore — 骨架已建，节点未联通 |
| 3 | 画布核心 | 🔲 下一步 | nodes/ 目录结构已建，节点拖拽/连线/执行未实现 |
| 4 | 文本节点 | 🔲 未开始 | Prompt / Chat / Optimize / Note / Storyboard |
| 5 | 图像生成节点 | 🔲 未开始 | Midjourney V7, Seedream 5.0, Kling 等 |
| 6 | 执行引擎 | 🔲 未开始 | backend/app/workers/ 目录存在但为空 |
| 7 | Skills 系统 | 🔲 未开始 | 元工作流链式调用 |
| 8 | 订阅计费 | 🔲 未开始 | Stripe |
| 9 | 主题 + 语言 + 收尾 | 🔲 未开始 | i18n 文件已有，未接入页面 |

---

## 已完成功能明细

### Slice 0 — 脚手架
- Docker Compose（frontend / backend / postgres / redis / minio）
- FastAPI + Alembic 迁移
- Vite + React + TypeScript + Tailwind

### Slice 1 — 用户系统
- Email OTP（开发模式自动填充，无需真实邮件）
- Google OAuth
- JWT 认证 + React 路由守卫
- Login / Signup 页面

### Slice 2 — Dashboard
- 工作流列表（3列网格）
- 创建新工作流（Create New 卡片）
- 双击卡片标题 → 内联重命名
- 三点菜单（hover 显示）：Rename / Make a copy / Move to Trash
- Trash 视图（?filter=trash）：Restore / Delete Forever / Empty Trash
- SideNav Trash 徽章显示数量
- Trash 持久化到 localStorage（前端，不需要后端）
- workflowStore：moveToTrash / restoreFromTrash / permanentlyDelete / copyWorkflow

### Slice 2.5 — 画布骨架
- CanvasPage.tsx（React Flow 挂载点）
- Canvas.tsx / CanvasControls.tsx / NodePicker.tsx / Toolbar.tsx
- canvasStore.ts（Zustand）
- nodes/ 目录结构：base / prompt / chat / optimize / image / upload / search / analysis / preview
- NodeBase / NodeTitle / PortDot 基础组件
- PlaceholderNode / PromptNode（未联通执行）
- dagUtils.ts（DAG 工具函数）

---

## 技术决策记录

| 决策 | 结论 | 时间 |
|------|------|------|
| 前端框架 | React + TypeScript + Vite | 2026-04-19 |
| 画布引擎 | React Flow v12 | 2026-04-19 |
| 后端框架 | FastAPI (Python) | 2026-04-19 |
| 部署平台 | Hetzner EU（芬兰/德国） | 2026-04-19 |
| 存储方案 | MinIO 自托管（EU GDPR 合规） | 2026-04-19 |
| 支付 | Stripe | 2026-04-19 |
| 品牌名 | Tanvas → Tangent（全局重命名） | 2026-04-20 |
| Trash 实现 | 前端 localStorage（不调 DELETE API，等永久删除再调） | 2026-04-20 |

---

## 待确认事项（阻塞开发的问题）

- [ ] **P0** Midjourney API：官方 API 还是 useapi.net 代理？（影响 MVP Image 节点）
- [ ] **P0** 邮件服务：用 SendGrid 还是 Resend？
- [ ] **P0** 服务器规格：Hetzner CX32（4核8G）是否足够？
- [ ] **P1** Search 节点：MVP 只用 Tavily，不做国内平台，确认？

---

## GitHub

- 仓库：https://github.com/chuhengtantt/TangentAgent
- 主分支：main
- 本地目录：/Users/orcastt/Code project/TanvasAgent（待手动重命名为 TangentAgent）

---

## 如何开始新的开发对话

```
先读项目根目录的 PRD.md、ARCH.md、project_state.md，了解当前状态。
然后我们来做：[具体任务]
```
