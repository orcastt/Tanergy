# TANGENT Development Harness Index

本文件是新接手 AI / 开发者的“执行索引”。它把产品、架构、设计、认证、支付、实时、数据库、发布、测试、管理后台、AI 和运维 12 类工作流映射到当前 TANGENT 项目。

Canonical docs 仍然是：

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. `dev-plans/README.md`
6. 当前 slice plan

短上下文入口是：

1. `Project_state/current-slice.md`
2. `Project_state/00-current-progress.md`
3. `ARCH/README.md`
4. 相关 `ARCH/*.md` slice file

`HARNESS.md` 只回答：**做某一类功能时，先读哪里、边界是什么、怎么验收。**

开发模式分两类：

- `Fast UI polish`：只改本地 UI、布局、响应式、状态文案、图标、菜单或浏览器 smoke follow-up。优先读短上下文，通常只更新 `Project_state/current-slice.md`、必要时更新 `Project_state/00-current-progress.md`、active dev-plan 或相关 `ARCH/Slice-*.md`。
- `Architecture slice`：涉及数据模型、API、权限、Auth、AI、Admin、Billing、Deploy、协作或长期产品边界。必须读并同步 canonical docs。

当前核对快照：

| 章节 | 核对结论 |
|------|----------|
| 1. Global Rules | 已同步当前 Slice E 状态：FastAPI / S3-compatible / Postgres / Web-to-FastAPI / staging package / `/workspaces` Board gallery/list shell、Board History、Board Management metadata 和 per-board Canvas Settings 已落地。 |
| 2. Definition Of Ready | 已补 0-to-1 阶段、外部资源、Auth/AI 前置条件。 |
| 3. Definition Of Done | 已补后端 pytest / compileall、staging smoke、docs-only 验证口径。 |
| 4. Workstream Harnesses | 已按当前优先级重排：Staging / Database / Board CRUD / Auth / AI / Ops 是 P0 主线，Collaboration 仍 P0.5；Admin S0 只做 schema/access/audit 边界，完整 analytics 后置。 |
| 5. Feature Harness Rules | 已补 Asset / Board Persistence、Deploy / Ops、Auth、Board CRUD、AI 接入边界。 |
| 6. Current Priority | 已同步为 `ARCH.md` 11.5-11.7 的 0-to-1 sprint 路线。 |
| 7. Handoff Prompt | 已补当前接手点和禁止事项。 |
| 8. Source Size Watchlist | 保留当前 250 行以上源码 watchlist，后续触碰先拆。 |

---

## 1. Global Rules

- P0 是 Web-first AI image canvas，不做桌面端。
- S1.5、Asset LOD Slice A-D 和 Slice E 的本地 Asset / Board persistence baseline 已通过。
- 当前已完成：Next local Asset / Board bridge、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata adapter、Board History first pass、captured Board thumbnail first pass、manual Refresh preview、History preview thumbnails、per-board Canvas Settings、Smart Drawing first pass、expanded Board Management metadata first pass、Web-to-FastAPI switch、staging API Docker package 和 `/workspaces` Board gallery/list entry shell。
- 当前 blocker 不再是“有没有 Asset/Board persistence seam”，而是把 staging package 接到真实 server / managed Postgres / R2 / staging Web origin，并把 Workspace Board CRUD / Auth / AI Run 依序产品化；外部资源未就绪时，本地优先 thumbnail 浏览器视觉 smoke、长时回归、Smart Drawing 阈值调参和 i18n/status polish。
- 0-to-1 总路线以 `ARCH.md` 11.5-11.7 为准；Sprint 级任务拆分见 `ARCH.md` 11.5.1。
- 不读不改 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求。
- 不读取 `.env`，不把 API Key 写入前端或日志。
- 不把真实 API Key、数据库 URL、R2/S3 secret、Email provider secret 写进文档、前端代码或日志。
- Board document、节点 `shape.props`、未来协作文档都只能保存轻量状态和 Asset / Run 引用，不保存 `data:` / `blob:` / Base64 图片、Provider 原始响应、完整日志或长分析文本。
- 新增 AI 节点、AI Chat bot 或新模型能力时，先执行 `ARCH.md` 4.4.1 AI Node Extension Contract：Node Registry、Model Registry、AiRun、route/test 和 Board guard 一起更新。
- Admin S0 只能作为服务端权限、审计和事实源边界；真实 Auth 前不得开放生产 `/admin`，Admin 权限不能只靠前端 role。
- 源码文件 250 行预警，300 行上限；超过前先拆分。
- 每个非简单功能先更新或确认 `dev-plans/`、`PRD.md` 功能状态和 `ARCH.md` 模块边界。
- 每个切片只做当前目标，不顺手扩展未来功能。
- 外部市场评分、收入、竞品数据必须联网查证并标注来源；不能凭空写入 PRD。

---

## 2. Definition Of Ready

开工前必须满足：

- 已判断本次是 `Fast UI polish` 还是 `Architecture slice`。
- Fast UI polish 已读 `Project_state/current-slice.md`、必要时读 `Project_state/00-current-progress.md`、`ARCH/README.md` 和相关 slice 文件。
- Architecture slice 已读 `project_state.md`，知道当前阶段和下一步。
- Architecture slice 已读 `PRD.md` 2.1 当前状态、5 功能完成定义和 9 验收清单。
- Architecture slice 已读 `ARCH.md` 相关模块边界；如果涉及上线/资源/部署，还要读 11.5-11.7。
- 已确认本切片 Scope / Non-goals / Acceptance。
- 已确认本切片在 0-to-1 阶段中的位置：staging infra、deploy、Auth、Board CRUD、AI、Ops、Alpha 或 P0.5 collaboration。
- 涉及外部资源时，已确认需要的 domain、Postgres、R2/S3、Email、Provider、tldraw license、secrets 和 rollback 路径。
- 涉及 AI 时，已确认 Auth / Board / Asset 边界是否足够稳定；不得在无日志、无限流、无成本记录情况下接真实 provider；不得从节点 UI 直接调用 Provider。
- 大范围修复或高风险重构前已按用户要求 checkpoint commit。

---

## 3. Definition Of Done

完成时必须满足：

- 用户可见行为满足 PRD 验收。
- 代码符合 ARCH 分层，重型数据不进节点 props / document state。
- 触碰源码文件未超过 300 行。
- `project_state.md` 和对应 `dev-plans/` 已更新。
- 前端改动至少通过：
  - `npm -C apps/web run lint`
  - `npm -C apps/web run typecheck`
  - `npm -C apps/web run build`
  - `git diff --check`
- 后端/API 改动至少通过：
  - `PYTHONPATH=services/api python3 -m pytest services/api/tests`
  - `python3 -m compileall services/api/tangent_api`
  - `git diff --check`
- Staging / deploy 改动还要按 `deploy/staging/README.md` 跑 smoke：`/health`、CORS、Asset upload/read、Board save/load/history create-list-load、guard 422。
- 文档-only 改动至少跑 `git diff --check`，并在最终回复说明未跑代码测试。
- 未验证的手测项必须在最终回复中明确列出。

---

## 4. Workstream Harnesses

| # | Harness | 当前阶段 | Canonical Docs | P0 重点 |
|---|---------|----------|----------------|---------|
| 1 | Product / PRD | Active | `PRD.md` | P0 功能状态、F18 Asset / Board Persistence、Alpha acceptance gaps |
| 2 | Full-stack Architecture | Active | `ARCH.md` | Next.js + tldraw + Node Runtime + FastAPI + S3-compatible + Postgres + deploy |
| 3 | UI / UX Design System | Active | `reference/Design.md`, `reference/Design_reference.md`, PRD F03 | Product Shell、登录/注册/工作区/集合/设置/账户/团队/订阅页面、白板、顶部工具栏、左侧绘图属性栏、右侧 AI Chat |
| 4 | Auth / User Management | Next P0 | PRD F01, ARCH 1.3 / 8.1 / 10.2, ARCH 11.5 S5-S7 | Email OTP/magic link、session/JWT、Board / Asset 权限 |
| 5 | Payment / Credits | P1 | ARCH 1.4, cost plan | P0 只记录成本和限额，不做完整付费 |
| 6 | Realtime / Collaboration | P0.5 | ARCH 7.1.1 | Presence / 协作文档 / 服务端权威分层 |
| 7 | Database / API | Active | ARCH 5 / 8, PRD F18, `dev-plans/Asset-lod-roadmap.md`, `dev-plans/p0-database-schema-roadmap-2026-05-01.md` | Assets、Board save guard、Postgres persistence、Alembic migration scaffold、future AiRuns/Model Registry |
| 8 | Launch / Growth | Active P0 staging | ARCH 11.5-11.7, cost plan | Staging server/domain/R2/Postgres、Alpha 手测；社媒增长后置 |
| 9 | QA / Test Suite | Active | PRD 9, ARCH 11.3, `deploy/staging/README.md` | pytest、lint/typecheck/build、runtime/staging smoke、图片压力 |
| 10 | Admin / Analytics | S0 planning now, full P1/P2 | PRD 2.2 / 6, ARCH 4.11 / 5.9-5.13 | Admin S0 schema/access/audit boundary；完整 Mixpanel 级 analytics 后置 |
| 11 | AI Integration | Later P0 after Auth/Board | ARCH 4.6 / 8.4 / 8.5, ARCH 11.5 S11-S15 | Model Registry、AI Runs、成本、结构化错误、结果入 Asset |
| 12 | Deploy / Monitor / Recovery | Active P0 | ARCH 11, `deploy/staging/README.md` | local/staging/prod、日志、回滚、备份、限流、成本熔断 |

---

## 5. Feature Harness Rules

### Product Harness

适用：改 PRD、改用户流程、改功能优先级。

- 必须说明 Problem / User / Value / Scope / Non-goals。
- MoSCoW 改动必须同步到 PRD 功能列表。
- 新用户故事必须能落到一个功能编号。
- 成功指标先用 Alpha 假设；市场数字必须 sourced。
- 当前 P0 状态改动优先同步 `PRD.md` 2.1、5 和 9；F18 Asset / Board Persistence 是当前 P0 blocker，不要只写在 ARCH。

### Architecture Harness

适用：改技术栈、数据模型、API、状态分层、部署。

- 必须说明客户端 vs 服务端边界。
- 必须说明数据归属、持久化位置和权限校验。
- 不能让前端保存 Provider Key。
- 不能把 `blob:` / `data:` / Base64 / Provider 原始响应写入持久化 document。
- 改 Board / Asset / AiRun / Auth 边界时，同步检查 `ARCH.md` 3、4、5、8、11。

### UI / UX Harness

适用：画布、工具栏、设置面板、绘图属性栏、AI Chat。

- UI 默认 English-first；中文开发备注不能混进正式业务文案。
- Product Shell 页面以 `reference/Design.md` 为 canonical；Stitch 页面级参考提炼在 `reference/Design_reference.md`。
- Top App Shell navigation 固定为 Landing page / Workspace / Collection / Team / Subscription；Landing page 只出现在顶部导航，不放入侧栏；Account 和 Settings 保持侧栏入口。
- Landing page / Collection / Account / Settings / Team / Subscription 必须保持清晰路由语义：Collection/Team/Subscription 不回指 `/workspaces`，不假装真实素材库、邀请、权限、订阅或支付已完成。
- 白板体验优先，不把产品改成纯工作流编辑器。
- Per-board Canvas Settings 可以保存为 Board document 的轻量 `canvasSettings`：background style/color、pattern color、spacing、snap preference/strength、zoom sensitivity；Dots 背景必须保持细小、低对比度、接近 Stitch 参考，不做重装饰。
- 右侧保留给 AI Chat；左侧只保留固定绘图属性栏。P0 不显示独立 Node Inspector，节点参数和状态留在节点卡片内。
- Smart Drawing 属于本地画布工具增强：只能把用户自己的 draw stroke 拟合成普通 line/geo/draw shape；不调用 AI provider，不改变 Board/Asset/AiRun 边界。
- 小 UI 可以后置；阻塞级问题优先：坐标、连线、性能、误触。
- `/workspaces` 是当前 Board gallery/list 产品入口 shell；`/spikes/canvas` 仍可作为技术验证入口，但新产品体验要优先落到 `/workspaces` / `/boards/:boardId`。

### Node Runtime Harness

适用：Prompt / Image Gen / Image Gen 4 / Analysis / Image。

- 节点卡片只展示摘要和高频操作。
- 节点卡片承载 P0 所需的关键参数和状态；不要新增独立 Node Inspector。
- Output 允许 fan-out；input 默认单来源；多 image input 用动态端口扩展。
- `Image Gen 4` 四个输出端口分别传 asset 1-4。
- text 端口/线黄色，image 端口/线绿色。
- Mock 数据流已通过；接真实 AI 时只把 `asset_id` / `run_id` / 短摘要写回节点，不写 Provider 原始响应。

### Asset / Board Persistence Harness

适用：Asset upload/read、Board validate/list/save/load/history、Workspace Board gallery、`/boards/:boardId` save UX、staging persistence smoke。

- 所有图片入口都必须先成为 Asset，再进入 Board document。
- Board save 前必须运行 guard，拒绝 `data:` / `blob:` / Base64-like payload。
- Board list 只返回 summary，不返回 document。
- Board load 才返回 document，并按 workspace/user 校验。
- Board History document 也必须通过 guard；history list 只返回 summary，history load 才返回 document。
- Board document 可包含轻量 `canvasSettings`，但仍不得包含图片数据、笔迹采样大 payload、Provider 原始响应或日志。
- P0 History retention 默认免费层每个 Board autosave 100 条 + user saves 100 条分桶保留；Pro/Enterprise 长期历史只写 schema/roadmap，不假装已完成。
- Web persistence client 必须能在未设置 `NEXT_PUBLIC_API_BASE_URL` 时走 Next local bridge，设置后走 FastAPI `/api/v1`。
- Staging smoke 必须检查 R2/S3 object、Postgres rows、CORS 和 workspace isolation。

### Auth / Board CRUD Harness

适用：注册、登录、邮箱验证、session/JWT、Board rename/delete/search、路由保护。

- Auth 接入前允许 dev fallback；production 前必须由服务端 token/session 解析 user/workspace。
- 前端传 `x-tangent-user-id` / `x-tangent-workspace-id` 只能用于 local-dev，不是权限依据。
- `/workspaces` 和 `/boards/:boardId` 都必须受保护；未登录跳 `/login`。
- Board rename/delete/search 必须按 workspace 过滤；delete 要有确认或可撤销策略。
- Auth / Board CRUD 稳定后再接真实 AI provider。

### AI Integration Harness

适用：Model Registry、AI Runs、Analysis、AI Chat Planner。

- 新增 AI 节点必须先声明 node spec、端口、参数 schema、model capability、run type、result shape、preview UI、failure states 和 persistence constraints。
- Node Registry、Model Registry、AiRun request/response、Next/FastAPI routes、tests、Board guard 必须一起更新，不能只改节点 UI。
- 前端只传 `selected_model_id`，后端按 Model Registry 二次校验。
- 真实 Provider 参数和费用只在后端处理。
- Run 必须有 status、latency、cost、error_code、retryable。
- 余额不足、模型不可用、内容违规都返回结构化错误。
- 真实 AI 结果必须写 Asset / object storage 和 AiRun log，再回到 Image Node；不能直接把 provider URL / base64 写进 Board。
- AI Chat / Planner 只能输出合法 graph spec，让 Node Runtime 应用节点和连线；不能绕过节点合同直接写 Provider 结果。
- AI 接入顺序默认是 Model Registry / AiRun schema → provider proxy → Image Gen → Analysis → AI Chat planner。

### Admin / Analytics Harness

适用：`/admin` shell、管理员权限、用户管理、后台备注、审计、AI 成本视图、事件埋点、漏斗、留存、收入和审核。

- P0 不做完整 Mixpanel 级后台；Admin S0 只允许 schema/access/audit boundary 和最小用户管理 MVP。
- `/admin` 入口必须由服务端 session + `admin_roles` 决定；普通用户不显示入口，直接访问返回 403。
- 不使用 `users.role = admin` 作为唯一权限来源；admin role 独立于公开用户 profile。
- 所有后台写操作都必须写 `admin_audit_logs`，包括授予/撤销管理员、封禁用户、积分调整、会员调整、模拟用户、审核动作。
- 管理员备注写 `admin_user_notes`，不能混入用户公开资料。
- 模拟用户只允许短时、可撤销、强审计；真实 Auth 完成前不要实现生产可用 impersonation。
- 后台模型线路管理必须扩展 Model Registry / AiRun / `ai_api_calls`，不能另建一套 provider truth。
- 漏斗、cohort、收入、成本图表必须来自 `analytics_events`、credit/billing ledger、AiRun/API call facts 或聚合表，不能从前端 UI 状态临时猜测。
- Admin 页面不能暴露 Provider API Key、数据库 URL、R2/S3 secret、完整原始 prompt 或敏感 payload。

### QA Harness

适用：任何可手测切片。

- 从最小路径开始测，再测错误/删除/刷新/缩放。
- Canvas 必测 50% / 100% / 200%、resize、Retina、高 DPI。
- 节点必测连接、删除、移动、fan-out、非法类型、Run disabled。
- 图片必测 MIME、大小、长边、5-10 张导入压力。
- Smart Drawing 必测近似直线、圆/椭圆、矩形、三角形、不可识别涂鸦保留原样、undo、保存/刷新/History restore。
- Merge 必测“不截 UI、网格、选择框”。
- Persistence 必测保存、刷新、重开、workspace isolation、guard bad case 和对象存储/数据库真实记录。
- Windows dense-board stutter 目前是 non-blocking follow-up，但 Alpha 前仍要进入回归矩阵。

### Ops Harness

适用：部署、监控、事故恢复。

- local / staging / production 分环境。
- `.env.example` 只写变量名，不写真实值。
- PostgreSQL 需要备份；对象存储需要保留和删除路径。
- AI 成本必须有限流和熔断开关。
- 不直接在服务器上手改代码；默认本地 commit/push 后 staging deploy，再 smoke。
- Production 必须独立 env、独立 Postgres、独立 R2 bucket、独立 domain；不能复用 staging secret。

---

## 6. Current Priority

当前按 `ARCH.md` 11.5-11.7 的 0-to-1 阶段推进，优先级如下：

1. 把现有 staging API package 接到真实 server / managed Postgres / R2 / staging Web origin，并按 `deploy/staging/README.md` 跑 smoke。
2. 建立推送 / 部署流水线：Git remote、Web deploy、VPS Docker deploy、env secret 管理和 rollback。
3. 继续把 `/workspaces` Board gallery/list 和 `/boards/:boardId` Board entry 产品化；当前 shell 已支持 Board summary list、gallery/list、create/open/search/sort/rename/copy/delete、settings-like Board Panel metadata、top Copy link / Invite、thumbnail placeholder/URL/upload/captured preview/remove default、manual Refresh preview、History preview thumbnails、owner/admin editable guard、star/pin/share/visibility menu actions、member scaffold、shape/asset count、`lastOpenedAt`、Recently opened / Recently saved sorting、client-side Load more、基础空/错/加载状态、按 board id load、Board 模式 autosave/save indicator、Board History first pass 和 Smart Drawing first pass；Refresh preview / Workspace card / History thumbnail browser smoke 已通过，Smart Drawing 已过前端闸门和 recognizer smoke。App Shell 顶部 5 标签与 Landing page / Collection / Account / Settings / Team / Subscription 语义已收口，下一步补 Smart Drawing browser tuning、long-session regression 或真实 staging wiring。
4. Auth scaffold / 注册边界已有 first pass：typed session/user/workspace、Next/FastAPI session endpoint、route guard 形状和 dev auth-required smoke；真实 Email OTP 或 magic link、session/JWT、保护 `/workspaces` / `/boards/:boardId` 和 API 需要外部资源后继续。
5. AI contract scaffold 已有 first pass；下一步可做 Board save/History 长时回归、真实 staging wiring，或在外部资源就绪后进入真实 Model Registry / AI Proxy / Image Gen / Analysis。
6. Alpha 前补安全/运维：rate limit、上传 abuse guard、AI budget kill switch、日志、备份恢复、CORS、Terms/Privacy 占位。
7. Admin S0 只保留 schema/access/audit boundary：真实 Auth 完成前不开放生产 `/admin`；后续用户管理 MVP 必须依赖 `admin_roles` 和 `admin_audit_logs`。
8. 数据库生产化继续推进：本地 auto-create 可保留，staging/prod 应运行 Alembic migration 并关闭 opportunistic schema mutation。
9. 多人协作继续后置到 P0.5，必须等 Asset / Board / Auth / AI Run 边界稳定。

持续硬要求：

1. 保持 Board document save guard：任何持久化路径都不能写入 `data:` / `blob:` / Base64 图片 payload。
2. 验证 refresh / load 后图片、节点、runtime edges 和 camera 能恢复；staging 必须验证 R2/Postgres 有真实记录。
3. API Key、数据库 URL、R2/S3 secret 和 Email provider secret 只在服务端环境或 secret manager，不进前端和文档。
4. 继续遵守源码 300 行上限；触碰 watchlist 文件前优先拆分。

---

## 7. Handoff Prompt

新对话建议直接粘贴：

```text
如果只是小 UI polish，先读 AGENTS.md、Project_state/current-slice.md、Project_state/00-current-progress.md、ARCH/README.md、ARCH/Slice-S0-local-polish.md 和 active dev-plan。若涉及数据/API/Auth/AI/Admin/Billing/Deploy/协作，先读 project_state.md、PRD.md、ARCH.md、HARNESS.md、ARCH/05-data-model-and-api.md 和 dev-plans/README.md。不要读 legacy，不要读 .env。

当前接手点：继续 Slice E Real Asset Pipeline / 0-to-1 staging path。已完成 local Asset/Board bridge、FastAPI local-dev、真实 s3-compatible Asset adapter、Postgres Board / Asset metadata persistence、Board History first pass、Web-to-FastAPI switch、staging API package 和 /workspaces Board gallery/list entry shell。

下一步优先从真实 staging server / managed Postgres / R2 / staging Web origin smoke，或 Board save + History 长时浏览器回归开始；/workspaces Board gallery/list metadata、expanded Board Panel metadata、captured thumbnail first pass、manual Refresh preview、History preview thumbnails、Smart Drawing first pass、Auth scaffold、AI contract scaffold、Board History 和 Landing page/Collection/Account/Settings/Team/Subscription semantic shell 已有 first pass，Refresh preview / Workspace card / History thumbnail browser smoke 已通过，Smart Drawing tuning 仍可并行补。
```

---

## 8. Source Size Watchlist

这些源码文件已接近 300 行。后续如果继续触碰，优先拆分，不要直接继续堆功能：

| File | Current Risk | Next Split Direction |
|------|--------------|----------------------|
| `apps/web/src/app/styles/node-card-content.css` | 298 行 | 再改节点内容样式前拆 prompt / image / port CSS |
| `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx` | 291 行 | 已拆 primary tools / settings button；继续加 toolbar 行为前拆 shape / insert popover |
| `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` | 295 行 | 已拆 `useBoardSaveLifecycle.ts` / history controls / audit summary；再加保存或历史行为前继续拆 save orchestration |
| `apps/web/src/app/styles/canvas-action-icons.css` | 272 行 | 继续加图标前拆 selection / layer / align icons |
| `apps/web/src/features/smart-drawing/smartDrawingRecognizer.ts` | 280 行 | 继续加识别类型前拆 geometry helpers / classifiers |
| `apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx` | 256 行 | 已改固定侧拉绘图属性栏；继续加属性栏行为前拆 drawer shell / empty state |
| `apps/web/src/components/workspaces/BoardManagementPanel.tsx` | 253 行 | 再加 Board 管理行为前拆 identity / appearance sections |
| `apps/web/src/components/canvas/CanvasSpike.tsx` | 257 行 | 再加 header/board behavior 前拆 shell header / board chrome |
| `apps/web/src/components/canvas/useEditorRevision.ts` | 289 行 | 拆 editor revision helper / subscription helper |
| `apps/web/src/features/assets/assetPreviewResolver.ts` | 266 行 | 新增 resolver 行为前拆 persisted thumbnail / local cache helper |
| `services/api/tangent_api/storage/postgres_board_store.py` | 263 行 | 再加 Board storage 行为前继续拆 SQL writer / metadata update helpers |
| `services/api/tangent_api/schemas.py` | 155 行 | Board schemas 已拆到 `board_schemas.py`；继续加 API schema 前按 domain 拆模块 |
| `services/api/tangent_api/storage/postgres_board_snapshot_store.py` | 256 行 | 继续加 retention tier 前拆 SQL helpers |
| `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx` | 265 行 | 已拆 header / results / toolbar / state helpers；再加 Workspace 行为前拆 actions hook |
| `apps/web/src/app/styles/product-workspaces-board.css` | 244 行 | 当前 Workspace Board card/list 样式；继续增长前按 toolbar/card/list 拆分 |
| `apps/web/src/app/styles/product-management.css` | 246 行 | Landing page / Collection / Account / Settings / Team / Subscription shared styles；继续增长前拆 callout / panel / notice 样式 |

规则：

- 250 行是预警，不阻塞小修。
- 300 行是硬线；超过前必须拆。
- 新功能优先创建小文件，不在 spike 容器里继续膨胀。
