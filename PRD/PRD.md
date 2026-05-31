# TANGENT Product Requirements Index

**Updated**: 2026-05-20
**Status**: Canonical product overview and PRD slice index, aligned with the current parallel P0 alpha workstreams, the S3 commercial pivot, the S3/S4 Team-Group foundation baseline and the latest S1B/S2 cleanup: the Konva-only staging deploy is back online, strict Clerk session/admin smoke is green, staging database truth is now a fresh Supabase Pro Postgres project, the temporary Hetzner-local Postgres fallback has been removed, R2 staging objects were cleared for a clean asset lane, collaboration process updates no longer write every realtime change to Postgres, deployment readiness now has Web/API env templates plus a green public TLS/header/CORS/static-cache/API-health smoke and incident-response docs, `/account` and admin share a real hard-delete account path with Team/Group ownership guards, and the active AI provider path has switched back to GeekAI for text, analysis and image routes with `qwq-plus-latest` as the Chat/Prompt Optimizer default. Vercel staging now has server-only GeekAI env and direct Chat SSE is green on deployment `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg`; FastAPI-side uncommitted fixes still need API redeploy access because SSH from this workstation is currently rejected. The latest local regression pass restores stricter Board title handling, admin/workspace invite writes, streaming text UX, Nano Banana 2 image MIME persistence, active mover identity, smoother canvas drag and tooltip cleanup before the remaining API redeploy, staging browser/live-image smoke and deeper Yjs/provider work.

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

## P0 Security Acceptance Status

Security is now part of the alpha acceptance contract, not a later enterprise add-on. The product must protect signed-in Board, Workspace, Admin, Billing and AI surfaces from cross-tenant access; public share links from guessing, lingering access and indexing; uploads and remote imports from SSRF or executable document formats; canvas text, chat content, filenames, provider errors and audit text from XSS; browser write routes from CSRF; realtime rooms from unauthorized writes and flood traffic; and high-cost AI, upload, invite, export and share flows from short-window and daily abuse.

Current user-visible security expectations:

- Provider/API keys and secrets remain server-side only.
- Public share links support strong tokens, expiration, password protection, revoke/regenerate and default `noindex` handling.
- Board, Workspace, Team, Admin, Billing and AI actions are authorized server-side; frontend role labels are never authority.
- Unsafe `data:`, `blob:`, Base64 image, SVG, PDF and private-network remote image paths are rejected before persistence or proxying.
- Team invite acceptance enforces paid seat capacity before admitting another member.
- The release gate includes automated security tests plus staging-only checks for real Redis, auth, object storage, WebSocket load and payment credentials.

Implementation methods live in `../ARCH/ARCH.md`; the release checklist is `../docs/security-release-acceptance.md`; the tactical development ledger is `../dev-plans/p0-collaboration-security-hardening-2026-05-19.md`.

## PRD Slice Index

| Slice | File | Owns | Current status |
| --- | --- | --- | --- |
| S0 Local Product Shell | `Finished/PRD_slice_S0_local_product_shell.md` | Local user-visible app shell, Workspace, Board canvas, Board History, Canvas Settings, Board Management, Smart Drawing | Finished baseline; regression reference only |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | Real staging infra, real Auth, real user/workspace/board ownership, production Board CRUD | Active foundation slice; staging Web/API/Supabase Pro/R2 plus real Clerk session/admin smoke are green; second-round signed-in Board acceptance is mostly green, the `Manage board -> Copy board` Free-plan limit modal path is wired locally, and staging spot check plus Google/email flow verification and permission hardening remain |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | Product data model for accounts, workspaces, Boards, History, Assets and future billing/AI/admin joins | S1A core implemented through migration `0006`; current schema head also includes S2/S3 control-plane migrations; fresh Supabase Pro Alembic-head smoke is green |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | Online staging Web/API, Postgres, R2, DNS, monitoring and email readiness | In progress; rebuilt staging Web/API/Supabase Pro/R2, Konva-only redeploy and public ops readiness smoke are green, Vercel has the current GeekAI server env, the active release no longer depends on the retired dirty worktree or temporary local Postgres fallback, repo-owned env templates/runbooks now exist, and API redeploy access, R2 clean asset, Google/email, live AI and external monitoring/backup/error-tracking proof remain |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration, login, logout, session and default workspace flow | Clerk frontend/session bridge, FastAPI bearer verification, Tanergy profile onboarding/editing, Clerk-backed forgot-password flow and a real `/account` delete path landed; Google/email/logout hardening remains |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board and History user workflows | Stable first-pass CRUD/member/share/public-share checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard; next tranche is effective permission hardening |
| S1E Board Packages | `PRD_slice_S1E_board_packages.md` | `.tgy` Tanergy Board Package export/import for reusable Boards with drawings, images, AI nodes and runtime edges | Planned; Board JSON and Asset foundations exist, user-facing package export/import remains |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | Legacy canvas migration closeout, Konva/Yjs handfeel and collaboration viability | Konva-only formal Board route is accepted locally and on staging, the old tldraw web path is gone from the active product surface, and draft collaboration preview/page-limit/node minimum sizing have first passes; production collaboration plus export polish remain |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | Real AI provider path, Model Registry, AiRun, cost/credit logs, AI Chat planner | Canvas-facing GeekAI-first fast path now proves chat streaming, prompt optimization, image generation/edit/reference and analysis UX locally; Chat/Prompt Optimizer default to GeekAI `qwq-plus-latest`, backend short-text `AiRun`, durable terminal `text_output`, message-native chat backendization and GeekAI route defaults now exist and are verified on staging DB; direct staging Chat SSE is green after Vercel env sync; active image-generation UI is aligned to GPT Image 2, Nano Banana 2 and Doubao Seedream 5.0 Lite, and the production gate is one live server-backed image smoke through the AiRun provider-route/billing control plane |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access, user management, credits, subscriptions, Team wallets, Group/Collaborate personal wallets, workspace dashboards, analytics, moderation, public pricing and policy pages | Active pivot: migration `20260508_0012/0013`, payer resolver, settlement contracts, Team checkout/top-up, Collaborate checkout, provider-neutral checkout adapter, signed webhook inbox, Group create, workspace invite contracts, real usage buttons, public no-auth pricing, draft Privacy/Terms/AI policy pages, admin directory APIs, tabbed admin console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, admin finance reconciliation panels, manual admin operations, operator inventory/detail first pass, same-origin admin/workspace invite proxy fixes and disposable Postgres smoke now support Team wallet vs personal Collaborate wallet while Stripe is unavailable; account delete is now a real hard-delete path, live checkout remains disabled, and the next hardening cut is paid Team/Group membership/subscription blockers plus legal/payment readiness |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | Multi-user Board collaboration, presence, roles, conflict boundaries | Planned next slice after the current acceptance spine; reusable invite/member contracts, canonical role language, final-snapshot persistence, draft drawing presence preview and post-stage active-mover/tooltip/camera fixes exist, while production multiplayer still remains outside the release promise |

## Update Rules

- During active development, update only the relevant `PRD_slice_*.md`.
- When a slice reaches a stable checkpoint, update the status table above.
- Do not duplicate detailed acceptance lists in this index.
- Product requirements go here; implementation details go to `../ARCH/`.
- Current progress, commits and handoff notes go to `../project_state/`.
- All active product slices inherit a maintainability acceptance rule: touched source files should stay under 300 lines, and any feature that would overgrow a file includes the split as part of acceptance.

## Current Product Priority

The current product priority is stabilization, not breadth.

Immediate order:

1. Finish the remaining staging signed-in browser, Google/email and live AI smokes.
2. Fold the refreshed image path fully behind the server-owned AiRun/provider-route boundary.
3. Continue Yjs/provider deepening only after those server and deployment gates are cleaner and verified.

## Current Product Readiness Snapshot

These percentages are product-readiness markers, not time estimates:

```text
S1X Canvas/Konva runtime      78%  stable local Board path; export/Yjs/live AiRun polish pending
S1A Schema/DB foundation      84%  core join points and Team-wallet schema delta exist; fresh Supabase Pro Alembic-head smoke is green, measured query-plan tuning remains
S1B Deploy/staging            91%  rebuilt Hetzner API host, public HTTPS API, Supabase Pro fresh schema, historical R2/board smoke, Konva-only staging web deploy and public ops readiness smoke are green; release-style staging deploy, private shared env handling, Web/API env templates and incident runbook are in place, while R2 clean asset, Google/email, live AI smoke and external monitoring/backup/error-tracking proof remain
S1C Auth/registration         78%  Clerk/FastAPI bearer boundary, admin bootstrap, Tanergy profile onboarding/editing, visible Clerk-backed forgot-password and real staging session/admin smoke now exist; Google/email/logout hardening remains
S1D Board/share/invites       72%  CRUD/share/member first pass, workspace invite backend contracts and Team/Group role UI first pass exist; billing visibility separation pending
S1E Board packages            05%  `.tgy` package format/requirements documented; export/import UI and asset rehydration pending
S2 AI runtime/provider routes 72%  GeekAI-first local UX path and backend route defaults exist and are verified on staging DB; Chat/Prompt Optimizer default to `qwq-plus-latest`; backend short-text `AiRun`, durable `text_output`, message-native chat backendization, image refresh and longer image timeout now exist; remaining gate is live image smoke and broader provider coverage
S3 Admin/billing/team         97%  admin/billing/team scaffolds, Team-wallet payer + settlement contract tests, Team/Collaborate checkout, provider-neutral checkout adapter, signed payment webhook inbox, Group create, workspace invite/member contracts, real `/usage` checkout buttons, public no-auth `/pricing`, draft public legal/policy pages, billing return routes, admin directory APIs, tabbed admin console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, admin finance reconciliation panels, manual admin operations, operator inventory/detail read model, inline pending invite rows, local detail patching for invite/member/board actions, arbitrary workspace invite/add-member actions, searchable Join Team/Join Group detail modals, board copy/delete actions, plan-catalog editing, disposable Postgres quote/run-settlement smoke and an opt-in local operator demo seed exist; live payment/tax/invoice/refund depth remains disabled and pending
Frontend product UI alignment 71%  major surfaces, public pricing/legal pages, wide full-browser layout, table-first AI route management, DB-backed Team/Group/Billing reads, Team/Group member actions, first-pass Billing actions, tabbed admin console, admin finance panels and operator row-level invite/member/board loops exist; authenticated subscription/usage plan language, loading states and cost messaging still need alignment
S4 Collaboration              35%  local Yjs room/document foundation, reconnect/resync smoke harness, draft drawing presence preview, final-snapshot persistence and post-stage mover-identity/tooltip/camera fixes exist; provider-grade multiplayer is still deferred from the release promise
```

Shipping-now promise:

- Konva-only Board runtime is the production-facing canvas path.
- Public landing -> Auth -> protected workspace -> Board -> share viewer is the core user journey.
- Billing, Team, Usage, Admin and AI route controls are first-pass bounded surfaces; the next business-system cut is role policy UI, provider settlement depth and staging smoke.
- The active release-spine document is `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md`.

Deferred or frozen for this pass:

- Production collaboration/Yjs.
- Real external billing automation.
- Full production provider coverage across every AI node type beyond the current GeekAI-first local fast path and the first server AiRun smoke route.
- Collections as a true asset-library product.
- Deep enterprise governance and finance tooling.

Near-term execution order:

1. Restore API deploy access, redeploy the FastAPI side of the post-stage fixes, then staging spot check Board title rejection, admin edits, workspace invite generate/revoke, `Manage board -> Copy board` Free-plan modal, Chat node resize/tooltip cleanup and canvas drag smoothness.
2. Run two-user invite/reopen plus active-mover identity smoke, then finish Google/email verification plus production-like CORS/origin behavior.
3. Run one real GeekAI live image smoke, including Nano Banana 2 image display/MIME verification.
4. Stabilize S1/S1X/S1D on staging/Auth/share/page/permission boundaries.
5. Rebuild S3 payer semantics around Team wallet, personal Collaborate wallet and auditable usage.
6. Rebuild the S3 admin operator console around fast User inventory and one-call user detail bundles.
7. Add S1E `.tgy` Board Package export/import after the current Board/Asset guard remains stable.
8. Push collaboration, deep finance, broad provider automation and other frozen areas after the alpha spine is stable.

## Product Stage Roadmap

```text
S0 Local Alpha accepted
  - local workspace/board shell
  - Board save/history/thumbnails
  - Canvas Settings and Smart Drawing

S1 Account + Ownership foundation
  - S1X Konva-only Board runtime established as the production path
  - register/login/logout/session
  - user default workspace
  - server-scoped Board CRUD and History
  - owner/admin/editor/viewer permission checks
  - first-pass public share entry for shared Konva Boards
  - `.tgy` Tanergy Board Package export/import for portable Board reuse

S2 AI Productization
  - canvas-facing GeekAI-first fast path proven locally
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

**更新日期**：2026-05-20
**状态**：规范产品总览和 PRD 切片索引，当前已对齐本轮 P0 alpha 的并行工作流、S3 商业口径调整，以及最新 S1B/S2 检查点：Konva-only staging 部署已恢复上线，严格 Clerk session/admin smoke 已转绿，staging 数据库事实源已切到 fresh Supabase Pro Postgres，临时 Hetzner 本机 Postgres fallback 已删除，R2 staging 对象已清理，协同过程更新不再逐条写入 Postgres，部署就绪现在已有 Web/API env 模板、TLS/header/CORS smoke、错误追踪接入和事故响应文档，活跃 AI provider path 已切回 GeekAI text / analysis / image routes；第二轮 signed-in Board 验收大部分已绿，`Manage board -> Copy board` 的 Free-plan limit 弹窗路径已完成本地 wiring，剩余闸门是 R2 clean asset smoke、该弹窗路径的 staging spot check、Google/email、一条真实服务端生图 smoke，以及外部监控/备份/错误追踪平台证明，然后才继续更深的 Yjs/provider 工作。

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

## P0 安全验收状态

网络安全现在属于 alpha 验收合同，不再是后置企业版功能。产品必须防住 signed-in Board / Workspace / Admin / Billing / AI 的跨租户越权，防止公开 share link 被猜测、长期残留或被索引，防止上传和远程导入触发 SSRF 或可执行文档格式，防止 canvas text、chat 内容、文件名、provider error、audit 文本产生 XSS，防止浏览器写接口被 CSRF 利用，防止 realtime room 被未授权写入或刷爆，并对 AI、upload、invite、export、share 等高成本入口做短窗口和每日配额防刷。

当前用户可见安全口径：

- Provider/API key 和所有 secret 只保留在服务端。
- 公开分享链接支持强 token、过期、密码、撤销 / 重建，并默认 `noindex`。
- Board、Workspace、Team、Admin、Billing、AI 操作都由服务端鉴权；前端角色标签不作为权限事实。
- 不安全的 `data:`、`blob:`、Base64 图片、SVG、PDF 和内网远程图片路径会在持久化或代理前被拒绝。
- Team 邀请接受会先检查已购 seat 容量，达到上限时不允许继续加入成员。
- 发布闸门包含自动化安全测试，以及真实 Redis、Auth、对象存储、WebSocket 压测和 payment credentials 的 staging-only 检查。

具体实现方法放在 `../ARCH/ARCH.md`；发布验收清单位于 `../docs/security-release-acceptance.md`；战术开发台账位于 `../dev-plans/p0-collaboration-security-hardening-2026-05-19.md`。

## PRD 切片索引

| 切片 | 文件 | 负责内容 | 当前状态 |
| --- | --- | --- | --- |
| S0 Local Product Shell | `Finished/PRD_slice_S0_local_product_shell.md` | 本地用户可见 app shell、Workspace、Board canvas、Board History、Canvas Settings、Board Management、Smart Drawing | 已完成 baseline；仅作为 regression reference |
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | 真实 staging infra、真实 Auth、真实 user/workspace/board ownership、生产 Board CRUD | 活跃基础切片；staging Web/API/Supabase Pro/R2 与真实 Clerk session/admin smoke 已转绿；Google/email 流程验证、最终 signed-in Board 验收和权限硬化仍待完成 |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | accounts、workspaces、Boards、History、Assets 以及未来 billing/AI/admin join points 的产品数据模型 | S1A core 已通过 migration `0006` 实现；当前 schema head 还包含 S3/S2 control-plane migrations；fresh Supabase Pro Alembic-head smoke 已通过 |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | 在线 staging Web/API、Postgres、R2、DNS、监控和 email readiness | 进行中；重建后的 staging Web/API/Supabase Pro/R2 与 Konva-only redeploy 已转绿；临时本机 Postgres fallback 已删除；repo 内 ops smoke/env 模板/事故手册已存在；R2 clean asset、Google/email、live AI 与外部监控/备份/错误追踪证明仍待完成 |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration、login、logout、session 和 default workspace flow | Clerk frontend/session bridge、FastAPI bearer verification 与真实 staging session/admin smoke 已落地；Google/email/logout hardening 仍待完成 |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board 和 History 用户流程 | CRUD/member/share/public-share 第一阶段稳定，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard；下一批是 effective permission hardening |
| S1E Board Packages | `PRD_slice_S1E_board_packages.md` | `.tgy` Tanergy Board Package 导出 / 导入，用于复用带绘图、图片、AI 节点和 runtime edges 的 Board | 已规划；Board JSON 与 Asset 基础已存在，用户可见 package export/import 仍未实现 |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | 旧画布迁移收口、Konva/Yjs 手感和协作可行性 | Konva-only formal Board route 已在本地和 staging 接受，旧 tldraw Web 路径已退出活跃产品面；draft collaboration preview、page-limit、node minimum sizing 已有第一阶段；production collaboration 与 export polish 仍待完成 |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | 真实 AI provider path、Model Registry、AiRun、cost/credit logs、AI Chat planner | 面向画布的 GeekAI-first fast path 现在已经在本地证明 chat streaming、prompt optimization、image generation/edit/reference 和 analysis UX；后端短文本 `AiRun`、durable terminal `text_output`、message-native chat backendization 和 GeekAI route defaults 已存在；活跃生图 UI 已对齐 GPT Image 2、Nano Banana 2、Doubao Seedream 5.0 Lite；生产闸门是一条通过 AiRun provider-route/billing control plane 的 live image smoke |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access、user management、credits、subscriptions、Team wallets、Group/Collaborate personal wallets、workspace dashboards、analytics、moderation、公开 pricing 和 policy pages | 活跃调整：migration `20260508_0012/0013`、payer resolver、settlement contracts、Team/Collaborate checkout、provider-neutral checkout adapter、signed webhook inbox、Group create、workspace invite contracts、real usage buttons、公开免登录 pricing、draft Privacy/Terms/AI policy pages、admin directory APIs、tabbed admin console、active-tab server bootstrap、idle-warmed client tab keepalive、分页 Team/Group dashboards、AI route metrics、table-first AI route management、admin finance reconciliation panels、manual admin operations、operator inventory/detail first pass 和 disposable Postgres smoke 已在 Stripe 不可用时支持 Team wallet vs personal Collaborate wallet；live checkout 仍禁用，下一步是 provider-neutral hosted/manual-test staging payment settlement、invoice/refund 深度和 legal/payment readiness |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | 多用户 Board 协作、presence、roles、conflict boundaries | 推迟到 P0.5；本地/provider 形态 bridge、reconnect/resync harness、draft drawing presence preview 和 final-snapshot persistence 已存在，但生产多人协作仍不在本轮承诺内 |

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
S1A Schema/DB foundation      84%  core join points 与 Team-wallet schema delta 已存在；fresh Supabase Pro Alembic-head smoke 已转绿，剩余是实测 query plan 调优
S1B Deploy/staging            91%  重建后的 Hetzner API、public HTTPS API、Supabase Pro fresh schema、历史 R2/board smoke、Konva-only staging Web 与当前公开 ops readiness smoke 已转绿；Web/API env 模板、错误追踪接入和事故手册已存在；R2 clean asset、Google/email、live AI smoke 与外部监控/备份/错误追踪证明仍待完成
S1C Auth/registration         78%  Clerk/FastAPI bearer 边界、admin bootstrap、Tanergy profile onboarding/editing、可见 Clerk-backed forgot-password 和真实 staging session/admin smoke 已存在；Google/email/logout hardening 仍待完成
S1D Board/share/invites       72%  CRUD/share/member 第一阶段、workspace invite backend contracts 和 Team/Group role UI first pass 已存在；billing visibility separation 待完成
S1E Board packages            05%  `.tgy` package format/requirements 已记录；export/import UI 与 asset rehydration 待完成
S2 AI runtime/provider routes 72%  GeekAI-first 本地 UX 路径与后端 route defaults 已存在且已在 staging DB 验证；后端短文本 `AiRun`、durable `text_output`、message-native chat backendization、生图刷新和更长生图超时已存在；剩余闸门是 live image smoke 与更广 provider 覆盖
S3 Admin/billing/team         97%  admin/billing/team 脚手架、Team-wallet payer + settlement 合同测试、Team/Collaborate checkout、provider-neutral checkout adapter、signed payment webhook inbox、Group create、workspace invite/member contracts、real `/usage` checkout buttons、公开免登录 `/pricing`、draft public legal/policy pages、billing return routes、admin directory APIs、tabbed admin console、active-tab server bootstrap、idle-warmed client tab keepalive、分页 Team/Group dashboards、AI route metrics、table-first AI route management、admin finance reconciliation panels、manual admin operations、operator inventory/detail first pass、inline pending invite rows、invite/member/board action 的本地 detail patching、任意 workspace 的 invite/add-member actions、可搜索的 Join Team/Join Group detail modals、board copy/delete actions、disposable Postgres quote/run-settlement smoke，以及本地可选的 operator demo seed 已存在；live payment/tax/invoice/refund 仍禁用并待完成
Frontend product UI alignment 71%  主要界面、公开 pricing/legal pages、table-first AI route management、Team/Group member actions、第一阶段 Billing actions、tabbed admin console、admin finance panels，以及 operator 行内 invite/member/board 操作回路已存在；认证后的 Subscription/Usage 套餐语言、loading states 和扣费文案还需要对齐
S4 Collaboration              35%  本地 Yjs room/document 基础、reconnect/resync smoke harness、draft drawing presence preview 和 final-snapshot persistence 已存在；provider 级多人协作仍后置
```

本轮当前承诺：

- Konva-only Board runtime 是面向生产的主画布路径。
- Public landing -> Auth -> protected workspace -> Board -> share viewer 是核心用户旅程。
- Board title rename/create/settings must reject symbol-heavy names consistently, and admin/workspace/invite browser mutations must succeed through strict same-origin/Bearer-auth paths without disabling backend CSRF.
- GeekAI image generation, including Nano Banana 2 chat-completion image output, must return displayable persisted Assets even when provider MIME wrappers disagree with the image bytes.
- Billing、Team、Usage、Admin 和 AI route controls 都只是第一阶段有限能力界面；下一步业务系统主线是 Team wallet + personal Collaborate wallet。
- 当前活跃的发布主线文档是 `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md`。

本轮延后或冻结：

- 生产级 collaboration/Yjs。
- 真实外部 billing automation。
- 超出当前 GeekAI-first 本地 fast path 和第一条服务端 AiRun smoke route 的完整生产 provider 覆盖。
- 作为真实资产库产品的 Collections。
- 深层 enterprise governance 和 finance tooling。

近期执行顺序：

1. 下一次部署后先跑 staging ops readiness smoke。
2. 再完成 R2 clean asset smoke、`Manage board -> Copy board` Free-plan limit 弹窗 staging spot check、Google/email 与 production-like CORS/origin 验收。
3. 把 GeekAI-first 画布 fast path 收口到 server-side AiRun provider-route/billing control plane。
4. 围绕 Team wallet、personal Collaborate wallet 和可审计 usage 重建 S3 payer semantics。
5. 围绕 fast User inventory 和 one-call user detail bundle 重做 S3 admin operator console。
6. 在 alpha spine 稳定后，再推进 collaboration、deep finance、广泛 provider automation 和其他 frozen areas。

## 产品阶段路线图

```text
S0 Local Alpha accepted
  - local workspace/board shell
  - Board save/history/thumbnails
  - Canvas Settings and Smart Drawing

S1 Account + Ownership foundation
  - S1X Konva-only Board runtime 已确立为生产路径
  - register/login/logout/session
  - user default workspace
  - server-scoped Board CRUD and History
  - owner/admin/editor/viewer permission checks
  - first-pass public share entry for shared Konva Boards
  - `.tgy` Tanergy Board Package export/import for portable Board reuse

S2 AI Productization
  - canvas-facing GeekAI-first fast path proven locally
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
