# TANGENT Product Requirements Index

**Updated**: 2026-05-08
**Status**: Canonical product overview and PRD slice index, now aligned with the current parallel P0 alpha workstreams and the S3 commercial pivot: Team plans use isolated Team workspaces with Team wallets, while Group/Collaborate uses personal wallets.

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

## P0 Alpha Release Spine

The current release pass is intentionally narrower than the full roadmap. Only these four product lines are release-critical now:

1. Canvas / Board / Page / Share / Auth
2. One real AI provider path
3. Billing mock + usage / ledger visible
4. Admin minimum operating surface

Everything else should be described as deferred, frozen or internal scaffolding unless it directly tightens one of those four lines.

## PRD Slice Index

| Slice | File | Owns | Current status |
| --- | --- | --- | --- |
| S0 Local Product Shell | `Finished/PRD_slice_S0_local_product_shell.md` | Local user-visible app shell, Workspace, Board canvas, Board History, Canvas Settings, Board Management, Smart Drawing | Finished baseline; regression reference only |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | Real staging infra, real Auth, real user/workspace/board ownership, production Board CRUD | Active foundation slice; staging Web/API/Neon/R2 smoke and local member/share/public-share first pass exist; Auth/email/OAuth smoke and permission hardening remain |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | Product data model for accounts, workspaces, Boards, History, Assets and future billing/AI/admin joins | S1A core implemented through migration `0006`; current schema head also includes S3 entitlement extension `0007`; staging DB smoke remains part of S1B |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | Online staging Web/API, Postgres, R2, DNS and email readiness | In progress; Web/API/Neon/R2 smoke passed, Konva redeploy/Auth/email/OAuth smoke pending |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration, login, logout, session and default workspace flow | Clerk frontend/session bridge and FastAPI bearer verification first pass landed; hardening remains |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board and History user workflows | Stable first-pass CRUD/member/share/public-share checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard; next tranche is effective permission hardening |
| S1E Board Packages | `PRD_slice_S1E_board_packages.md` | `.tgy` Tanergy Board Package export/import for reusable Boards with drawings, images, AI nodes and runtime edges | Planned; Board JSON and Asset foundations exist, user-facing package export/import remains |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | Production license risk, tldraw reference parity, Konva/Yjs handfeel and collaboration viability | Konva v2 formal Board route accepted; Page polish and v1 copy tooling landed; collaboration/Yjs and export polish remain |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | Real AI provider path, Model Registry, AiRun, cost/credit logs, AI Chat planner | Canvas-facing GeekAI fast path now proves chat streaming, prompt optimization, image generation/edit/reference and analysis UX locally; Image Gen / Image Gen 4 model-aware UI includes GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng-style parameter surfaces; production gate is folding that path into the server AiRun provider-route/billing control plane and smoke-testing one live route |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access, user management, credits, subscriptions, Team wallets, Group/Collaborate personal wallets, workspace dashboards, analytics, moderation | Active pivot: migration `20260508_0012/0013`, payer resolver, settlement contracts, Team checkout/top-up, Collaborate checkout, provider-neutral checkout adapter, signed webhook inbox, Group create, workspace invite contracts, real usage buttons, admin directory APIs, tabbed admin console, AI route metrics, admin finance reconciliation panels, manual admin top-up/plan/cancel controls and disposable Postgres smoke now support Team wallet vs personal Collaborate wallet while Stripe is unavailable; provider-neutral hosted/manual-test staging payment settlement plus invoice/refund depth remain pending |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | Multi-user Board collaboration, presence, roles, conflict boundaries | Deferred to P0.5 |

## Update Rules

- During active development, update only the relevant `PRD_slice_*.md`.
- When a slice reaches a stable checkpoint, update the status table above.
- Do not duplicate detailed acceptance lists in this index.
- Product requirements go here; implementation details go to `../ARCH/`.
- Current progress, commits and handoff notes go to `../project_state/`.

## Current Product Priority

The current product priority is stabilization, not breadth.

## Current Product Readiness Snapshot

These percentages are product-readiness markers, not time estimates:

```text
S1X Canvas/Konva runtime      78%  stable local Board path; export/Yjs/live AiRun polish pending
S1A Schema/DB foundation      82%  core join points and Team-wallet schema delta exist; staging smoke remains
S1B Deploy/staging            60%  Web/API/Neon/R2 smoke exists; Auth/email/OAuth pass pending
S1C Auth/registration         55%  Clerk/FastAPI first pass exists; next gate is real-login admin access, CORS/origin smoke and first-session wallet closure
S1D Board/share/invites       72%  CRUD/share/member first pass, workspace invite backend contracts and Team/Group role UI first pass exist; billing visibility separation pending
S1E Board packages            05%  `.tgy` package format/requirements documented; export/import UI and asset rehydration pending
S2 AI runtime/provider routes 56%  GeekAI local UX path exists; server route/billing control-plane and live Team-wallet settlement smoke pending
S3 Admin/billing/team         83%  admin/billing/team scaffolds, Team-wallet payer + settlement contract tests, Team/Collaborate checkout, provider-neutral checkout adapter, signed payment webhook inbox, Group create, workspace invite/member contracts, real `/usage` checkout buttons, billing return routes, admin directory APIs, tabbed admin console, AI route metrics, admin finance reconciliation panels, manual admin top-up/plan/cancel controls and disposable Postgres quote/run-settlement smoke exist; payment/invoice/refund depth pending
Frontend product UI alignment 60%  major surfaces, Team/Group member actions, first-pass Billing actions, tabbed admin console and admin finance panels exist; nav, plan labels and cost messaging need alignment
S4 Collaboration              10%  boundary documented; Yjs/provider proof deferred
```

Shipping-now promise:

- Konva-first Board runtime is the production-facing canvas path.
- Public landing -> Auth -> protected workspace -> Board -> share viewer is the core user journey.
- Billing, Team, Usage, Admin and AI route controls are first-pass bounded surfaces; the next business-system cut is role policy UI, provider settlement depth and staging smoke.
- The active release-spine document is `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md`.

Deferred or frozen for this pass:

- Production collaboration/Yjs.
- Real external billing automation.
- Full production provider coverage across every AI node type beyond the current GeekAI local fast path and the first server AiRun smoke route.
- Collections as a true asset-library product.
- Deep enterprise governance and finance tooling.

Near-term execution order:

1. Finish the S1C auth/admin production boundary: real Clerk login, real admin access, no spoofable user/workspace headers, production-like CORS/origin behavior and default personal wallet on first session.
2. Stabilize S1/S1X/S1D on staging/Auth/share/page/permission boundaries.
3. Add S1E `.tgy` Board Package export/import after the current Board/Asset guard remains stable.
4. Fold the GeekAI canvas-facing path into the server-side AiRun provider-route/billing control plane.
5. Rebuild S3 payer semantics around Team wallet, personal Collaborate wallet and auditable usage.
6. Push collaboration, deep finance, broad provider automation and other frozen areas after the alpha spine is stable.

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
  - `.tgy` Tanergy Board Package export/import for portable Board reuse

S2 AI Productization
  - canvas-facing GeekAI fast path proven locally
  - real provider routes behind server AiRun
  - Model Registry and AiRun persistence
  - personal-wallet AI usage for Solo/Group, Team-wallet usage for Teams and provider cost facts

S3 Admin + Billing + Analytics
  - admin roles and audit logs
  - user management
  - credits, subscriptions, Team wallets, Group personal-wallet collaboration, dashboards and seat entitlements
  - revenue/usage/retention analytics

S4 Collaboration
  - live presence
  - multi-user Board editing
  - member roles and conflict/history behavior
```

S1 deliberately does not finish Admin, credits, subscriptions or collaboration. It creates the user/workspace/board ownership facts those stages need.

## 中文完整翻译

# TANGENT 产品需求索引

**更新日期**：2026-05-08
**状态**：规范产品总览和 PRD 切片索引，当前已对齐本轮 P0 alpha 的并行工作流，以及 S3 商业口径调整：Team 套餐使用彼此隔离的 Team workspace + Team wallet，Group/Collaborate 使用个人钱包。

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

## P0 Alpha 发布主线

当前这一轮发布范围，刻意比整张 roadmap 更窄。现在只有下面四条产品线属于发布关键路径：

1. Canvas / Board / Page / Share / Auth
2. 一个真实 AI provider 路径
3. Billing mock + usage / ledger 可见
4. Admin 最小可运营面

除此之外的内容，除非直接收紧这四条线之一，否则都应被描述为 deferred、frozen 或 internal scaffolding。

## PRD 切片索引

| 切片 | 文件 | 负责内容 | 当前状态 |
| --- | --- | --- | --- |
| S0 Local Product Shell | `Finished/PRD_slice_S0_local_product_shell.md` | 本地用户可见 app shell、Workspace、Board canvas、Board History、Canvas Settings、Board Management、Smart Drawing | 已完成 baseline；仅作为 regression reference |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | 真实 staging infra、真实 Auth、真实 user/workspace/board ownership、生产 Board CRUD | 活跃基础切片；staging Web/API/Neon/R2 smoke 与本地 member/share/public-share 第一阶段已存在；Auth/email/OAuth smoke 和权限硬化仍待完成 |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | accounts、workspaces、Boards、History、Assets 以及未来 billing/AI/admin join points 的产品数据模型 | S1A core 已通过 migration `0006` 实现；当前 schema head 还包含 S3 entitlement extension `0007`；staging DB smoke 仍归 S1B |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | 在线 staging Web/API、Postgres、R2、DNS 和 email readiness | 进行中；Web/API/Neon/R2 smoke 已通过，Konva redeploy/Auth/email/OAuth smoke 待完成 |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration、login、logout、session 和 default workspace flow | Clerk frontend/session bridge 与 FastAPI bearer verification 第一阶段已落地；仍需 hardening |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board 和 History 用户流程 | CRUD/member/share/public-share 第一阶段稳定，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard；下一批是 effective permission hardening |
| S1E Board Packages | `PRD_slice_S1E_board_packages.md` | `.tgy` Tanergy Board Package 导出 / 导入，用于复用带绘图、图片、AI 节点和 runtime edges 的 Board | 已规划；Board JSON 与 Asset 基础已存在，用户可见 package export/import 仍未实现 |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | 生产 license 风险、tldraw reference parity、Konva/Yjs 手感和协作可行性 | Konva v2 formal Board route 已接受；Page polish 和 v1 copy tooling 已落地；collaboration/Yjs 和 export polish 仍待完成 |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | 真实 AI provider path、Model Registry、AiRun、cost/credit logs、AI Chat planner | 面向画布的 GeekAI fast path 现在已经在本地证明 chat streaming、prompt optimization、image generation/edit/reference 和 analysis UX；Image Gen / Image Gen 4 的模型感知 UI 已覆盖 GPT Image 2、Nano Banana 2、Doubao Seedream 和 Jimeng 风格参数；生产闸门是把这条路径收口到服务端 AiRun provider-route/billing control plane，并完成一条 live route smoke |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access、user management、credits、subscriptions、Team wallets、Group/Collaborate personal wallets、workspace dashboards、analytics、moderation | 活跃调整：migration `20260508_0012/0013`、payer resolver、settlement contracts、Team/Collaborate checkout、provider-neutral checkout adapter、signed webhook inbox、Group create、workspace invite contracts、real usage buttons、admin directory APIs、tabbed admin console、AI route metrics、admin finance reconciliation panels、manual admin top-up/plan/cancel controls 和 disposable Postgres smoke 已在 Stripe 不可用时支持 Team wallet vs personal Collaborate wallet；provider-neutral hosted/manual-test staging payment settlement 以及 invoice/refund 深度仍待完成 |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | 多用户 Board 协作、presence、roles、conflict boundaries | 推迟到 P0.5 |

## 更新规则

- 活跃开发期间，只更新相关的 `PRD_slice_*.md`。
- 当某个切片达到稳定 checkpoint 时，更新上面的状态表。
- 不要在这个索引里重复详细验收列表。
- 产品需求放在这里；实现细节放到 `../ARCH/`。
- 当前进度、commits 和交接 notes 放到 `../project_state/`。

## 当前产品优先级

当前产品优先级是稳定化，不是继续扩面。

## 当前产品就绪快照

这些百分比是产品就绪度标记，不是时间估算：

```text
S1X Canvas/Konva runtime      78%  本地 Board 主路径稳定；export/Yjs/live AiRun polish 待完成
S1A Schema/DB foundation      82%  core join points 与 Team-wallet schema delta 已存在；staging smoke 仍待完成
S1B Deploy/staging            60%  Web/API/Neon/R2 smoke 已存在；Auth/email/OAuth 待通过
S1C Auth/registration         55%  Clerk/FastAPI 第一阶段存在；session hardening 待完成
S1D Board/share/invites       72%  CRUD/share/member 第一阶段、workspace invite backend contracts 和 Team/Group role UI first pass 已存在；billing visibility separation 待完成
S1E Board packages            05%  `.tgy` package format/requirements 已记录；export/import UI 与 asset rehydration 待完成
S2 AI runtime/provider routes 56%  GeekAI 本地 UX 路径存在；服务端 route/billing control-plane 和 live Team-wallet settlement smoke 待完成
S3 Admin/billing/team         83%  admin/billing/team 脚手架、Team-wallet payer + settlement 合同测试、Team/Collaborate checkout、provider-neutral checkout adapter、signed payment webhook inbox、Group create、workspace invite/member contracts、real `/usage` checkout buttons、billing return routes、admin directory APIs、tabbed admin console、AI route metrics、admin finance reconciliation panels、manual admin top-up/plan/cancel controls 和 disposable Postgres quote/run-settlement smoke 已存在；payment/invoice/refund 深度待完成
Frontend product UI alignment 60%  主要界面、Team/Group member actions、第一阶段 Billing actions、tabbed admin console 和 admin finance panels 已存在；导航、套餐语言和扣费文案需要对齐
S4 Collaboration              10%  边界已文档化；Yjs/provider proof 后置
```

本轮当前承诺：

- Konva-first Board runtime 是面向生产的主画布路径。
- Public landing -> Auth -> protected workspace -> Board -> share viewer 是核心用户旅程。
- Billing、Team、Usage、Admin 和 AI route controls 都只是第一阶段有限能力界面；下一步业务系统主线是 Team wallet + personal Collaborate wallet。
- 当前活跃的发布主线文档是 `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md`。

本轮延后或冻结：

- 生产级 collaboration/Yjs。
- 真实外部 billing automation。
- 超出当前 GeekAI 本地 fast path 和第一条服务端 AiRun smoke route 的完整生产 provider 覆盖。
- 作为真实资产库产品的 Collections。
- 深层 enterprise governance 和 finance tooling。

近期执行顺序：

1. 在 staging/Auth/share/page/permission 边界上继续稳定 S1/S1X/S1D。
2. 在当前 Board/Asset guard 稳定后加入 S1E `.tgy` Board Package export/import。
3. 把 GeekAI 画布 fast path 收口到 server-side AiRun provider-route/billing control plane。
4. 围绕 Team wallet、personal Collaborate wallet 和可审计 usage 重建 S3 payer semantics。
5. 在 alpha spine 稳定后，再推进 collaboration、deep finance、广泛 provider automation 和其他 frozen areas。

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
  - `.tgy` Tanergy Board Package export/import for portable Board reuse

S2 AI Productization
  - canvas-facing GeekAI fast path proven locally
  - real provider routes behind server AiRun
  - Model Registry and AiRun persistence
  - Solo/Group personal-wallet AI usage, Team-wallet usage and provider cost facts

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
