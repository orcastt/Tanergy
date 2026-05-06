# TANGENT Product Requirements Index

**Updated**: 2026-05-06
**Status**: Canonical product overview and PRD slice index, now aligned with S1D public share first pass, S3 admin bootstrap first pass and the documented Group/Team workspace + AI credit entitlement strategy.

This folder replaces the former root-level long PRD ledger. The root `PRD.md` is now only a pointer. Product details live in the slice files below.

## Product One-Liner

TANGENT is a web-first AI image canvas: a clean collaborative whiteboard where users arrange images, markup, prompt cards and AI nodes, then run AI image generation, image editing, image analysis and merge-capture flows.

## P0 Scope

```text
Prompt Node -> Image Gen / Image Gen 4 -> Image Node
Image Node + Prompt Node -> Image Gen / Analysis -> Image Node / Prompt Node
Image Node -> Canvas Markup -> Merge Capture -> New Image Node
AI Chat -> create allowed nodes + edges -> user confirms Run
```

P0 does not include production collaboration, a desktop app, full Mixpanel-grade analytics, full billing automation or a marketplace.

## PRD Slice Index

| Slice | File | Owns | Current status |
| --- | --- | --- | --- |
| S0 Local Product Shell | `PRD_slice_S0_local_product_shell.md` | Local user-visible app shell, Workspace, Board canvas, Board History, Canvas Settings, Board Management, Smart Drawing | Accepted for P0 alpha; checkpoint/regression only |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | Real staging infra, real Auth, real user/workspace/board ownership, production Board CRUD | Active foundation slice; member/share/public-share first pass now exists locally |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | Product data model for accounts, workspaces, Boards, History, Assets and future billing/AI/admin joins | Implemented and locally smoke-tested; staging DB smoke pending S1B |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | Online staging Web/API, Postgres, R2, DNS and email readiness | Waiting on resources |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration, login, logout, session and default workspace flow | After S1A |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board and History user workflows | After S1C |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | Production license risk, tldraw reference parity, Konva/Yjs handfeel and collaboration viability | Basic Konva Board migration checkpoint accepted; tldraw is development reference gated from production |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | Real AI provider path, Model Registry, AiRun, cost/credit logs, AI Chat planner | Mock runtime only; real provider path is next major productization step |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access, user management, credits, subscriptions, Group/Team workspace dashboards, analytics, moderation | First-pass admin access/summary/audit/role-management landed; read-only billing/workspace entitlement and AiRun payer contract now exist; real billing/ledger still pending |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | Multi-user Board collaboration, presence, roles, conflict boundaries | Deferred to P0.5 |

## Update Rules

- During active development, update only the relevant `PRD_slice_*.md`.
- When a slice reaches a stable checkpoint, update the status table above.
- Do not duplicate detailed acceptance lists in this index.
- Product requirements go here; implementation details go to `../ARCH/`.
- Current progress, commits and handoff notes go to `../project_state/`.

## Current Product Priority

S1X has moved from handfeel spike to primary canvas migration path:

- New/missing formal Boards default to Konva v2.
- Existing Konva v2 Boards open through the formal `/boards/[boardId]` route.
- Active share links now open through a dedicated public `/share/[shareId]` entry and consume a stored shared Board document in first-pass view-only mode.
- tldraw remains a development reference at `/spikes/canvas`, but production defaults block tldraw Board runtime usage.
- Workspace local old tldraw v1 Board data has been cleaned from the active dev workspace.
- Page/multi-board document contract, Page UI polish and explicit old-board v1-to-v2 copy tooling now have first passes.
- S1D now has a real first-pass share flow: people lookup, email invite, server-backed share-link create/revoke/resolve and public share consume.
- S3 now has a real first-pass admin bootstrap surface: server-gated `/admin`, summary/users/workspaces/boards/audit views and owner-only role management.
- S3 now also has a first documented launch packaging direction for `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- Group Workspace and Team Workspace now share the same core Board/member surface, while Team adds admin-visible per-member AI usage, total usage, expiry, Board count and Board/member inventory.
- AI charging is now defined as actor-personal for Free, Collaborate and Team; only explicit Enterprise contracts may use a workspace pool.
- A first read-only implementation now backs that strategy: `/billing`, `/team`, `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard`, `/api/v1/workspaces/current/entitlement` and mock AiRun payer summaries exist locally.
- A unified S1 launch-readiness report now tracks Page polish hand-test, deployment, database, Auth, AI, Admin and collaboration acceptance in `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`.
- Remaining near-term product work is no longer “make sharing exist”; it is real Auth rollout, richer `Can view/edit/manage/owner` permission flows, real paid-seat mutations, atomic actor-personal credit ledger charging, real AiRun execution, admin/developer console expansion, transparent-background/export details and Phase 6 collaboration proof.

This means the basic migration is accepted for local product direction, not that the whole canvas roadmap is complete. The production-facing Board experience should now be specified against Konva v2; tldraw should be treated as a comparison/reference surface while old Board migration, real collaboration and real AI execution are finished.

If external resources are not ready:

1. Hand-test S1X Page UI save/restore/history, page delete/reorder/Move to page and v1-to-v2 copy tooling on real Boards.
2. Finish and commit S1X Konva Board route polish and acceptance.
3. Continue real AiRun prep and provider contracts without adding new tldraw-only product work.
4. Expand admin search/pagination, Group/Team/share permissions and billing visibility contracts only after the S1 foundations stay stable.

If external resources are ready:

1. Staging Postgres/R2/domain smoke and Konva-first route deploy with tldraw disabled by default.
2. Real Auth and workspace ownership.
3. Auth-backed Board CRUD and public share flow hardening.
4. Group/Team/share permission hardening and billing visibility/credit entitlement wiring.
5. Real AI provider path through server-side AiRun.
6. Admin read-only MVP expansion after real Auth/admin roles.

## Product Stage Roadmap

```text
S0 Local Alpha accepted
  - local workspace/board shell
  - Board save/history/thumbnails
  - Canvas Settings and Smart Drawing

S1 Account + Ownership foundation
  - S1X Konva-first Board runtime replacing tldraw as production path
  - register/login/logout/session
  - user default workspace
  - server-scoped Board CRUD and History
  - owner/admin/editor/viewer permission checks
  - first-pass public share entry for shared Konva Boards

S2 AI Productization
  - real provider routes
  - Model Registry and AiRun persistence
  - actor-personal AI usage history, Team visibility rollups and cost facts

S3 Admin + Billing + Analytics
  - admin roles and audit logs
  - user management
  - credits, subscriptions, Group/Team workspace dashboards and seat entitlements
  - revenue/usage/retention analytics

S4 Collaboration
  - live presence
  - multi-user Board editing
  - member roles and conflict/history behavior
```

S1 deliberately does not finish Admin, credits, subscriptions or collaboration. It creates the user/workspace/board ownership facts those stages need.

## 中文完整翻译

# TANGENT 产品需求索引

**更新日期**：2026-05-06
**状态**：规范产品总览和 PRD 切片索引，当前已对齐 S1D 公共分享第一阶段、S3 后台 bootstrap 第一阶段，以及已文档化的 Group/Team workspace + AI credit entitlement 策略。

本文件夹取代原来的根级长 PRD 台账。根目录 `PRD.md` 现在只做指针用途。产品细节位于下面的切片文件中。

## 产品一句话

TANGENT 是一个 Web-first 的 AI 图像画布：一个干净的协作白板，用户可以排列图片、标注、prompt cards 和 AI nodes，然后运行 AI 图像生成、图像编辑、图像分析和 merge-capture 流程。

## P0 范围

```text
Prompt Node -> Image Gen / Image Gen 4 -> Image Node
Image Node + Prompt Node -> Image Gen / Analysis -> Image Node / Prompt Node
Image Node -> Canvas Markup -> Merge Capture -> New Image Node
AI Chat -> create allowed nodes + edges -> user confirms Run
```

P0 不包括生产级协作、桌面应用、完整的 Mixpanel 级分析、完整计费自动化或 marketplace。

## PRD 切片索引

| 切片 | 文件 | 负责内容 | 当前状态 |
| --- | --- | --- | --- |
| S0 Local Product Shell | `PRD_slice_S0_local_product_shell.md` | 本地用户可见 app shell、Workspace、Board canvas、Board History、Canvas Settings、Board Management、Smart Drawing | 已接受为 P0 alpha；仅保留 checkpoint / regression |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | 真实 staging infra、真实 Auth、真实 user/workspace/board ownership、生产 Board CRUD | 活跃基础切片；member/share/public-share 第一阶段已在本地存在 |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | accounts、workspaces、Boards、History、Assets 以及未来 billing/AI/admin join points 的产品数据模型 | 已实现并完成本地 smoke；staging DB smoke 等待 S1B |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | 在线 staging Web/API、Postgres、R2、DNS 和 email readiness | 等待资源 |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration、login、logout、session 和 default workspace flow | S1A 之后 |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board 和 History 用户流程 | S1C 之后 |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | 生产 license 风险、tldraw reference parity、Konva/Yjs 手感和协作可行性 | 基础 Konva Board migration checkpoint 已接受；tldraw 是开发参考并从生产 gated |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | 真实 AI provider path、Model Registry、AiRun、cost/credit logs、AI Chat planner | 只有 mock runtime；真实 provider path 是下一个主要产品化步骤 |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access、user management、credits、subscriptions、Group/Team workspace dashboards、analytics、moderation | 第一阶段 admin access/summary/audit/role-management 已落地；只读 billing/workspace entitlement 和 AiRun payer contract 现在已存在；真实 billing/ledger 仍待完成 |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | 多用户 Board 协作、presence、roles、conflict boundaries | 推迟到 P0.5 |

## 更新规则

- 活跃开发期间，只更新相关的 `PRD_slice_*.md`。
- 当某个切片达到稳定 checkpoint 时，更新上面的状态表。
- 不要在这个索引里重复详细验收列表。
- 产品需求放在这里；实现细节放到 `../ARCH/`。
- 当前进度、commits 和交接 notes 放到 `../project_state/`。

## 当前产品优先级

S1X 已经从手感 spike 进入 primary canvas migration path：

- New/missing formal Boards 默认使用 Konva v2。
- Existing Konva v2 Boards 通过正式 `/boards/[boardId]` route 打开。
- Active share links 现在通过专门的 public `/share/[shareId]` entry 打开，并在第一阶段 view-only 模式下消费 stored shared Board document。
- tldraw 仍然作为开发参考保留在 `/spikes/canvas`，但 production defaults 会阻止 tldraw Board runtime usage。
- Workspace local old tldraw v1 Board data 已经从 active dev workspace 清理。
- Page/multi-board document contract、Page UI polish 和 explicit old-board v1-to-v2 copy tooling 已经有第一阶段版本。
- S1D 现在有真实第一阶段 share flow：people lookup、email invite、server-backed share-link create/revoke/resolve 和 public share consume。
- S3 现在有真实第一阶段 admin bootstrap surface：server-gated `/admin`、summary/users/workspaces/boards/audit views 和 owner-only role management。
- S3 现在也有第一版已文档化上线套餐方向：`free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- Group Workspace 和 Team Workspace 现在共享同一套核心 Board/member surface，而 Team 额外提供 admin-visible per-member AI usage、total usage、expiry、Board count 和 Board/member inventory。
- AI charging 现在定义为 Free、Collaborate 和 Team 都使用 actor-personal；只有明确的 Enterprise contract 才可以使用 workspace pool。
- 这个策略现在已有第一阶段只读实现支撑：`/billing`、`/team`、`/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard`、`/api/v1/workspaces/current/entitlement` 和 mock AiRun payer summaries 都已在本地存在。
- 统一的 S1 launch-readiness report 现在在 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` 跟踪 Page polish hand-test、deployment、database、Auth、AI、Admin 和 collaboration acceptance。
- 剩余近期产品工作不再是“让 sharing 存在”；而是真实 Auth rollout、更丰富的 `Can view/edit/manage/owner` 权限流程、真实 paid-seat mutations、原子化 actor-personal credit ledger charging、真实 AiRun execution、admin/developer console expansion、transparent-background/export 细节和 Phase 6 collaboration proof。

这意味着基础迁移已经被本地产品方向接受，但并不代表整个 canvas roadmap 已经完成。面向生产的 Board 体验现在应该基于 Konva v2 来规格化；tldraw 应作为 comparison/reference surface，同时继续完成旧 Board migration、真实 collaboration 和真实 AI execution。

如果外部资源还没准备好：

1. 在真实 Boards 上手测 S1X Page UI save/restore/history、page delete/reorder/Move to page 和 v1-to-v2 copy tooling。
2. 完成并提交 S1X Konva Board route polish 和 acceptance。
3. 继续真实 AiRun prep 和 provider contracts，不新增 tldraw-only product work。
4. 只有在 S1 foundations 保持稳定后，再扩展 admin search/pagination、Group/Team/share permissions 和 billing visibility contracts。

如果外部资源已经准备好：

1. Staging Postgres/R2/domain smoke，以及默认禁用 tldraw 的 Konva-first route deploy。
2. 真实 Auth 和 workspace ownership。
3. Auth-backed Board CRUD 和 public share flow hardening。
4. Group/Team/share permission hardening 和 billing visibility/credit entitlement wiring。
5. 通过 server-side AiRun 接入真实 AI provider path。
6. 在真实 Auth/admin roles 后扩展 Admin read-only MVP。

## 产品阶段路线图

```text
S0 Local Alpha accepted
  - local workspace/board shell
  - Board save/history/thumbnails
  - Canvas Settings and Smart Drawing

S1 Account + Ownership foundation
  - S1X Konva-first Board runtime replacing tldraw as production path
  - register/login/logout/session
  - user default workspace
  - server-scoped Board CRUD and History
  - owner/admin/editor/viewer permission checks
  - first-pass public share entry for shared Konva Boards

S2 AI Productization
  - real provider routes
  - Model Registry and AiRun persistence
  - actor-personal AI usage history, Team visibility rollups and cost facts

S3 Admin + Billing + Analytics
  - admin roles and audit logs
  - user management
  - credits, subscriptions, Group/Team workspace dashboards and seat entitlements
  - revenue/usage/retention analytics

S4 Collaboration
  - live presence
  - multi-user Board editing
  - member roles and conflict/history behavior
```

S1 不刻意完成 Admin、credits、subscriptions 或 collaboration。它创建这些阶段所需要的 user/workspace/board ownership facts。
