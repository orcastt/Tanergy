# TANGENT Architecture Index

**Updated**: 2026-05-16
**Status**: Canonical architecture overview and slice index, aligned with the current parallel P0 alpha workstreams, the S3 Team-wallet pivot and the latest staging/S2 checkpoint: the rebuilt Konva-only staging deploy plus real Clerk session/admin smoke are green, self-delete and admin delete now share a real hard-delete service with Team/Group ownership guards, backend `AiRun` supports short text runs with durable `text_output`, and the active image-generation lane is refreshed onto four live GeekAI-backed models with the next gate being one live staged image smoke before deeper provider work.

This file replaces the former duplicated `ARCH/00-current-map.md` plus the long root `ARCH.md`. The root `ARCH.md` is now only a pointer.

## Parallel Development Swimlane

The original single-trunk diagram is no longer enough because Auth/deploy, Board permissions, Team/Group billing, AI provider routing, admin tooling and frontend node UI are now moving in parallel. The percentages below are coarse architecture-readiness markers as of 2026-05-14. They are not time estimates; they show whether a lane has a usable first pass, a server authority boundary and a remaining production gate.

```text
Current architecture readiness snapshot

S1X Canvas/Konva runtime      78%  [###############-----]
  Stable: Konva v2 Board route, pages, nodes, runtime edges, save/history/share view.
  Gate: rendered page thumbnails, export/background polish, real AiRun adapter, Yjs proof.

S1A Schema/DB foundation      82%  [################----]
  Stable: core user/workspace/board/asset/admin/AI/credit join points and migrations.
  Gate: staging migration/query smoke after the Team-wallet schema delta.

S1B Deploy/staging            79%  [################----]
  Stable: rebuilt Hetzner API host, public HTTPS API, Neon/R2/board smoke, Konva-only staging web deploy, pooled-runtime preference and slow-SQL logging are green.
  Gate: full signed-in browser board acceptance, Google/email/OAuth verification and one live provider smoke under staging auth.

S1C Auth/registration         72%  [##############------]
  Stable: Clerk frontend shell, FastAPI bearer verification, authorized-party checks, first-session personal wallet creation, admin bootstrap and real staging session/admin smoke.
  Gate: Google/email flow verification, session revocation/logout hardening and broader signed-in browser acceptance.

S1D Board/share/invites       73%  [###############-----]
  Stable: Board CRUD, owner-only copy/delete, share expiry, public view, member first pass, workspace invite backend contracts and Team/Group role UI first pass with owner/admin/member gating.
  Gate: billing-visibility separation, explicit Asset sharing, invite email delivery.

S1E Board packages            05%  [#-------------------]
  Stable: `.tgy` package decision, product/architecture contract and existing Konva Board JSON plus Asset foundations.
  Gate: package writer/reader, asset binary bundling, import rehydration, asset-id rewrite, UI actions and package safety tests.

S2 AI runtime/provider routes 68%  [##############------]
  Stable: model/route/pricing tables, quote/preflight, persisted AiRun shell, admin facts, backend text-run contract, durable terminal `text_output`, message-native chat-node backendization, four-model image refresh and a 240s live-image timeout boundary.
  Gate: staging live image smoke, broader live-provider coverage and retirement of production dependence on local AI fast paths.

S3 Admin/billing/team         97%  [###################-]
  Stable: server-gated admin, admin directory APIs, tabbed developer console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, AI route/pricing panels, Team checkout/top-up, Collaborate checkout, hosted checkout response contract, provider-neutral checkout adapter, signed webhook inbox, workspace invite/member contracts, payer settlement contracts, billing return routes, admin finance reconciliation, audited manual admin operations, operator User inventory/detail read model, five-tab user detail, centered manual-finance modals, native user status/delete, subscription freeze/unfreeze, arbitrary Team/Group invite/add-member actions, searchable Join Team/Join Group detail modals, inline pending invite rows, local detail patching for invite/member/board mutations, board copy/delete actions, unified payment-ledger-subscription-audit billing history rows and an opt-in local demo seed for dense operator QA.
  Gate: staging redeploy, Alembic-head/admin_roles real-login smoke, provider-specific signatures, renewal automation, invoices, refunds and deeper route health views.

Frontend product UI alignment 69%  [##############------]
  Stable: workspaces, boards, billing, team, usage, tabbed admin console, table-first AI route management, canvas node surfaces, Team/Group role-gated member actions, first-pass Billing actions, admin finance reconciliation panels, operator row-level invite/member/board loops and the wide full-browser layout pass exist.
  Gate: align navigation, loading/empty states, role language, plan labels and AI cost messaging against the now-live backend data.

S4 Collaboration              27%  [#####---------------]
  Stable: local Yjs document/awareness foundation, room-shaped transport, reconnect/resync smoke harness, local collaborative undo/redo and structural page reconcile now exist behind the Konva board path.
  Gate: provider-grade websocket reconnect/resync, multi-instance persistence, conflict semantics for page/shape/container moves and production performance smoke after S1/S2 authority boundaries are stable.
```

Dependency view:

```text
S1B Deploy + S1C Auth
  -> S1D Board/workspace permission
       -> S2 AiRun permission + credit preflight
       -> S3 Team/Group visibility + billing/admin facts

S1X Konva canvas
  -> Node Registry + runtimeGraph
       -> S2 server AiRun lifecycle
       -> Asset refs back into Board-safe node outputs
       -> S1E `.tgy` package export/import asset rehydration

S2 Model/Route/Pricing control plane
  -> Provider adapter selection
  -> Credit/provider-cost settlement
  -> S3 Admin runtime and finance observability

Frontend UI alignment runs across all lanes and should follow, not invent, server authority.
```

## Architecture Slice Index

| Slice | File | Owns | Update when |
| --- | --- | --- | --- |
| S0 Local Polish | `Finished/ARCH_slice_S0_local_polish.md` | Product shell, Workspace, Board save/history, Canvas Settings, Smart Drawing, Board Management, Canvas controls | Finished baseline; regression reference only |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI, Postgres, R2/S3, migrations, Auth, real Board CRUD, deployment | Active umbrella; keep detailed truth in S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema, Alembic migrations, constraints, indexes, future-compatible join points | S1A core implemented through `0006`; current head also includes S3 entitlement extension `0007` |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel, FastAPI host, Postgres, R2, domain, email provider, staging smoke | Web/API/Neon/R2, Konva-only redeploy and real session/admin smoke passed; Google/email/live-AI smoke pending |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration, login, sessions, request context, workspace membership authority | Clerk/FastAPI bearer first pass plus Tanergy-owned profile/onboarding boundary and account-deletion boundary landed; logout/session hardening remains |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | Stable first-pass CRUD/member/share/public-share-open checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard |
| S1E Board Packages | `ARCH_slice_S1E_board_packages.md` | `.tgy` package format, export/import flow, asset rewrite and package safety boundary | Planned; uses Konva Board serializer, Board guard and Asset APIs as foundations |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | Legacy canvas migration closeout, Konva/Yjs replacement path | Konva-only formal Board route accepted; Page polish and legacy-doc safety landed; collaboration still pending |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | Mock/runtime dataflow and the local GeekAI canvas path now prove the user-facing image/analysis/chat flow; DB-backed model tiers/pricing/routes, quote/preflight, persisted lifecycle, attempt-level `ai_api_calls`, timeout-safe failover, extracted settlement orchestration, durable short `text_output`, four-model image refresh and message-native chat backendization now exist; production gate is staging live image smoke plus broader live-provider coverage |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, Team wallets, personal Collaborate wallets, credits, subscriptions, workspace dashboards, AI charge facts, analytics, moderation facts | Active pivot: migration `20260508_0012/0013`, payer resolver, settlement contracts, Team/Collaborate checkout, provider-neutral checkout adapter, signed webhook inbox, workspace invite/member contracts, usage checkout buttons, admin directory APIs, tabbed admin console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, admin finance reconciliation panels, manual admin operations, operator inventory/detail read model, native user status/delete, native subscription freeze/unfreeze, arbitrary Team/Group invite-add-member writes, inline pending invite rows, local detail patching for invite/member/board mutations, board copy/delete writes, admin hot-path performance cleanup and local disposable-Postgres admin/payment smoke now support Team wallet vs personal Collaborate wallet while Stripe is unavailable; user delete is now a real hard-delete path with Team/Group ownership guards, while public staging repair plus invoice/refund depth remain |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer, presence, CRDT boundaries, roles | Deferred to P0.5 for release promise, but local Yjs room/document foundations are now real; providerization and production-hardening still wait on Auth, Board, Asset and AiRun authority |

## Project Architecture Overview

```text
Browser
  |
  v
Next.js Web App
  |-- Product Shell routes
  |     |-- / public homepage
  |     |-- /workspaces protected workspace shell
  |     |-- /share/[shareId] public shared-Board entry
  |     |-- /admin server-gated first-pass management surface
  |-- Canvas Runtime
  |     |-- /boards/[boardId] formal Board shell
  |     |-- Konva v2 primary Board runtime
  |-- Board / Asset / AI clients
  |
  +-- local Next API bridge --------------+
  |                                       |
  v                                       v
FastAPI API ----------------------> Storage Adapters
  |                                  |-- PostgreSQL: users/workspaces/boards/history/assets/ai/admin
  |                                  |-- R2/S3-compatible: image binaries/thumbnails
  |                                  |-- local-dev filesystem adapters
  |
  v
External Providers
  |-- AI image/text providers
  |-- Email provider
  |-- Payment provider
```

## P0 Alpha Architecture Spine

Only these architecture lines are release-critical in the current pass:

1. Landing/Auth/workspace/Board/share route boundaries
2. Konva-only Board persistence and page/history safety
3. One server-side AiRun/provider execution path with payer preflight and Team/personal wallet settlement
4. Bounded billing visibility plus server-gated admin/operator routes

Architectural implications:

- Collaboration transport, live presence and CRDT room sync remain deferred.
- External payment-provider automation remains deferred.
- Placeholder product routes may remain in code, but should not drive the main architecture story.

## Source Tree And Documentation Index

```text
apps/web
  src/app                 Next routes and local API bridge
  src/components/canvas   retired pre-Konva canvas code kept only for historical diff/reference
  src/components/konva-canvas
                          Konva primary canvas runtime, stage, tools, nodes, save/history
  src/components/workspaces
  src/features/boards     Board documents, engine detection, metadata, History, client contracts
  src/features/board-packages
                          Planned `.tgy` package manifest, export/import and asset rewrite helpers
  src/features/canvas-engine
                          renderer-neutral CanvasDocument, geometry and shape contracts
  src/features/assets     Asset upload, thumbnails, runtime migration
  src/features/node-runtime
                          Node Registry, runtime graph and mock run adapter
  src/features/ai         Model Registry and AiRun client contracts
  src/features/auth       Session/request-context scaffold
  src/features/admin      Admin directory, finance reconciliation, AI route metrics/control plane and access clients

services/api
  tangent_api             FastAPI app, routers, schemas, storage adapters
  migrations              Alembic P0 migration scaffold
  scripts                 bootstrap helpers such as first-pass admin owner grant
  tests                   API contract tests

PRD                       Product requirement slices
ARCH                      Architecture slices
project_state             Current progress and handoff slices
dev-plans                 Active implementation plans and historical archive
```

Canonical documentation ownership:

| Folder/File | Role | Index file | Slice pattern |
| --- | --- | --- | --- |
| `PRD/` | User-visible product requirements and acceptance | `PRD/PRD.md` | `PRD/PRD_slice_*.md` |
| `ARCH/` | Architecture boundaries, diagrams, APIs and schemas | `ARCH/ARCH.md` | `ARCH/ARCH_slice_*.md` |
| `project_state/` | Current progress, handoff state and next steps | `project_state/project_state.md` | `project_state/project_state_slice_*.md` |
| `dev-plans/` | Tactical implementation plans and runbooks | `dev-plans/README.md` | dated plan files, archived in `dev-plans/Archive/` |

Current active tactical references:

| Plan | Purpose |
| --- | --- |
| `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md` | Current P0 alpha shipping spine and acceptance gates |
| `dev-plans/s1e-tgy-board-package-export-import-2026-05-08.md` | `.tgy` Tanergy Board Package export/import tactical plan |
| `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` | Fold GeekAI and future providers into server-owned AiRun route switching, credit settlement and admin observability |
| `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md` | Rebuild `/admin` around fast user inventory, one-call user detail bundles, modal operations and role-aware Team/Group management |
| `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Team wallet, personal Collaborate wallet, invites, seats, membership, billing usage and payer resolver |
| `dev-plans/s3-billing-team-entitlements-strategy-2026-05-06.md` | Superseded market benchmark and historical pricing reference |

Completed/reference content that still appears in this architecture file:

| Content | Current label | Why it remains |
| --- | --- | --- |
| S0 local alpha / local polish | Completed baseline | Regression reference only; do not reopen as current architecture scope |
| Legacy v1 Board documents/history | Blocked from the active app path | Prevent silent mixed-engine restore while keeping migration history explainable |
| Old single-trunk stage diagram | Completed/reference flow | Useful historical dependency map, but current planning uses the parallel swimlane above |
| Former `ARCH/00-current-map.md` mirror | Retired | This `ARCH/ARCH.md` is the canonical map |

## Canvas Engine Parallel Architecture

S1X now runs a Konva-only Board path in the active web app. Historical migration behavior still matters as context, but the runtime boundary, route behavior and persistence contract are all Konva-owned now.

```text
Browser route
  |
  +-- /boards/[boardId]
  |     |
  |     +-- load existing Board document unless ?new=1
  |     |
  |     +-- boardCanvasEngine detector
  |           |
  |           +-- Konva v2 envelope
  |           |     { version: 2, renderer: "konva", activePageId, pages, canvasDocument, canvasSettings, assets }
  |           |       |
  |           |       v
  |           |     KonvaCanvasSpike
  |           |       |-- KonvaCanvasStage
  |           |       |-- KonvaCanvasToolbar + Properties + Settings + Pages panel
  |           |       |-- Konva runtime edges / nodes / image operations
  |           |       |-- KonvaBoardSaveAudit
  |           |       v
  |           |     Board API save/load/history/thumbnail
  |           |
  |           +-- legacy v1 or unknown document
  |           |       |
  |           |       +-- blocked unsupported state
  |           |       +-- no implicit runtime fallback in the active app path
  |           |
  |           +-- new or missing Board
  |           |       |
  |           |       v
  |           |     blank Konva v2 Board
  |           |
  |           +-- unknown document
  |                   |
  |                   v
  |                 unsupported state; never auto-open blank and overwrite
  |
  +-- /share/[shareId]
        |
        +-- resolve stored share link
        +-- load shared Board document through share token
        +-- open Konva v2 Board in read-only viewer mode
```

Runtime ownership:

| Concern | Konva v2 production path | Legacy/migration handling | Shared boundary |
| --- | --- | --- | --- |
| Route | `/boards/[boardId]` for owned/member Boards, `/share/[shareId]` for public view-only shared Konva Boards | `/spikes/konva-canvas` is dev-only regression surface; legacy docs are blocked in active routes | Board shell and workspace/share entry points |
| Persistence | Konva v2 envelope, Board API, History, thumbnail | Legacy v1 document read/reference only | Board guard prevents unsafe overwrite |
| Editing | Shape/image/node editing, crop, export/capture, runtime edges | Behavior reference during migration | Renderer-neutral CanvasDocument target |
| Settings | Konva toolbar gear + shared Canvas Settings panel | Existing reference settings only | User-facing settings vocabulary |
| Assets | Image/capture/cutout URLs and compact refs only | Reference import behavior only | Asset API/object storage |
| AI nodes | Node Registry + runtimeGraph mock run adapter | Reference interaction patterns only | Future server-side AiRun contract |
| Collaboration | Pending Yjs/provider proof | Not a production dependency | S4 waits for stable Board/Asset/Auth/AiRun |

Persisted document flow:

```text
Konva interactions
  |
  v
CanvasDocument
  |-- shapes: rect/ellipse/line/arrow/draw/text/frame/sticky/image/node_card
  |-- runtimeEdges: renderer-neutral node dataflow edges
  |-- camera + metadata
  |
  +-- activePageId + pages[] envelope contract
  |     |-- canvasDocument remains active page mirror
  |     |-- Pages panel writes active page before save/switch/snapshot/page mutations
  |     |-- Page drawer delete/reorder + context-menu Move to page
  |
  +-- canvasSettings store
  |
  v
serializeKonvaBoardDocument()
  |
  v
Konva v2 envelope
  |
  +-- frontend board guard
  +-- FastAPI board guard
  |     |-- no data:/blob:/large Base64
  |     |-- schema-aware konva-v2 validation
  |     |-- runtime edge shape reference validation
  |
  v
Board storage
  |-- Board document JSON
  |-- Board History snapshots
  |-- thumbnail Asset reference
  |
  v
Restore
  |
  +-- validate envelope
  +-- replace CanvasDocument/camera/settings
  +-- clear transient selection/edit/crop/menu state
```

Asset and AI runtime boundaries:

```text
Images / captures / cutouts / thumbnails
  -> Asset API / object storage
  -> Board JSON stores asset ids, URLs, dimensions and compact refs only

Prompt/Image/Analysis/Image Gen nodes
  -> Node Registry + runtimeGraph
  -> mock Run adapter today
  -> future server-side AiRun contract before real provider calls
```

Feature development flow:

```text
New canvas feature
  |
  +-- product requirement changes
  |       -> PRD slice
  |
  +-- renderer-neutral data change?
  |       -> CanvasDocument / Node Registry / Board guard
  |
  +-- Konva runtime implementation
  |       -> components/konva-canvas + feature module tests
  |
  +-- Asset or AI side effect?
  |       -> Asset API or server-side AiRun contract
  |
  +-- tldraw behavior useful as reference?
          -> compare manually, do not add new tldraw-only product dependency
```

## Group/Team Workspace + AI Charging Architecture

The commercial system is intentionally split into four independent facts so permissions do not leak across layers:

```text
Plan tier
  free_canvas | collaborate_start | collaborate_plus | team_start | team_growth | enterprise

Workspace kind
  solo_workspace | group_workspace | team_workspace | enterprise_workspace

Workspace / Board authority
  workspace owner/admin/member/guest
  board owner/admin/editor/viewer/temporary_viewer

AI payer
  actor_personal by default
  workspace_pool only for explicit enterprise contracts
```

Runtime flow:

```text
AI Run request
  |
  v
Request Context
  actor_user_id + workspace_id + workspace_kind + board_id
  |
  v
Permission Resolvers
  WorkspaceAccessService
  BoardPermissionService
  DashboardVisibilityService
  |
  v
Entitlement Resolvers
  SeatEntitlementService
  CreditAccountService
  AiChargePreflightService
  |
  v
Server-side AiRun
  ai_runs + ai_api_calls + credit_ledger + api_cost_ledger
  |
  v
User/Admin Surfaces
  personal billing
  Group basic dashboard
  Team member-usage dashboard
  global /admin developer console
```

UI ownership:

```text
Group Workspace
  Boards / members / invites / roles
  basic structural dashboard
  no member-level billing visibility

Team Workspace
  same Board/member controls
  plus per-member AI usage, total usage, expiry, seat and Board inventory

Global /admin
  server-gated admin_roles
  users / workspaces / Boards / subscriptions / ledger / AiRuns / provider calls / audit
```

## Completed / Reference Stage Flow

This completed/reference flow shows the original dependency ladder. It is kept to explain why S1 identity/ownership gates S2/S3/S4, but current planning should use the parallel swimlane at the top of this file.

```text
S0 Accepted local alpha
  |
  v
S1 Real Boundary: staging + Auth + ownership + Board CRUD
  |
  +--> S1A DB schema + Alembic migrations
  |       users / workspaces / members / boards / snapshots / assets / auth facts
  |
  +--> S1B Staging infra smoke
  |       FastAPI health / Postgres / R2 / domain / CORS / Web API base URL
  |
  +--> S1X Canvas engine migration spike
  |       Konva v2 formal Board route, legacy-document guard, prove Yjs path later
  |
  +--> S1C Auth + request context
  |       register / login / logout / session / default workspace
  |
  +--> S1D Auth-backed Board CRUD
          list / open / save / history / copy / delete / members / share / public share view
          |
          +----------------------+----------------------+----------------------+
                                 |                      |                      |
                                 v                      v                      v
                         S2 AI Runtime          S3 Admin/Billing        S4 Collaboration
                         provider calls         users/credits/revenue   presence/roles/live sync
                         AiRun/cost logs        Group/Team dashboards   conflict/history rules
                                                analytics/moderation
```

Dependency rules:

- S1A is implemented locally; validate it against real Postgres during S1B.
- S1B needs staging Postgres/R2/domain/API resources.
- S1C depends on S1A and an email/session strategy.
- S1D depends on S1A/S1C and becomes the permission foundation for S2/S3/S4.
- S1D now includes first-pass public share entry, share-token Board open, backend `none/view/edit/manage/owner` resolution, owner-only copy/delete, share expiry and known-foreign Asset reference blocking; richer Group/Team workspace separation and explicit Asset-sharing allowlists still remain future work.
- S2 should use real `user_id`, `workspace_id`, `board_id` from S1 before charging credits or writing provider logs.
- S3 now has a first-pass server-gated `/admin` surface and reusable billing/team/usage scaffolds, but the active architecture gate is the Team-wallet plus personal Collaborate-wallet payer pivot before real Admin/Credits/Billing can be production authority.
- S1X currently provides the Konva-only Board runtime; it still needs collaboration/Yjs proof before S4.
- S4 must wait for S1 permissions and stable Board/Asset/History contracts.
- The current cross-slice handoff and acceptance checklist lives in `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`.
- Do not mix uncommitted S1X Page polish with backend/database/Admin/AI implementation changes; commit the accepted checkpoint first.

## Non-Negotiable Boundaries

- Board documents, Board History documents, node props and future collaboration docs must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text.
- Image binaries and thumbnails belong in object storage; documents store URLs/Asset ids only.
- Production Board runtime must be Konva v2 only; legacy Board documents are blocked instead of opening any fallback runtime.
- AI provider calls are server-side only and flow through Model Registry + AiRun contracts.
- Admin permissions are server-side through `admin_roles`; frontend role flags are not authority.
- Real collaboration waits until Asset, Board, Auth and AiRun boundaries are stable.
- Source files target under 300 lines; split before adding more behavior to already large files.

## Update Rules

- During active development, update the relevant `ARCH_slice_*.md`.
- Update this index only when a slice status, lane, core boundary or file architecture changes.
- Root `ARCH.md` is a pointer only.
- Do not maintain mirror files like `00-current-map.md`; this file is the map.

## 中文完整翻译

# TANGENT 架构索引

**更新日期**：2026-05-14
**状态**：规范架构总览和切片索引，当前已对齐正在并行推进的 P0 alpha 工作流、S3 Team-wallet 调整，以及最新 staging/S2 检查点：Konva-only staging 部署与真实 Clerk session/admin smoke 已转绿，后端 `AiRun` 已支持 durable `text_output`，活跃生图线路也已刷新到四个真实 GeekAI 图片模型；下一道闸门是一条真实 staging 生图 smoke，然后才继续更深的 provider 工作。

本文件取代原来的重复 `ARCH/00-current-map.md` 和根目录长 `ARCH.md`。根目录 `ARCH.md` 现在只做指针用途。

## 平行开发泳道

原来的单主干图已经不够用了，因为 Auth/deploy、Board 权限、Team/Group billing、AI provider routing、admin tooling 和 frontend node UI 正在并行推进。下面的百分比是截至 2026-05-14 的粗颗粒架构就绪度，不是工时估算；它表示每条线是否已有可用第一阶段、服务端权威边界，以及还剩哪个 production gate。

```text
当前架构就绪度快照

S1X Canvas/Konva runtime      78%  [###############-----]
  已稳定：Konva v2 Board route、pages、nodes、runtime edges、save/history/share view。
  闸门：rendered page thumbnails、export/background polish、real AiRun adapter、Yjs proof。

S1A Schema/DB foundation      82%  [################----]
  已稳定：user/workspace/board/asset/admin/AI/credit 的核心 join points 和 migrations。
  闸门：Team-wallet schema delta 之后的 staging migration/query smoke。

S1B Deploy/staging            79%  [################----]
  已稳定：重建后的 Hetzner API 主机、public HTTPS API、Neon/R2/board smoke、Konva-only staging Web deploy，以及 pooled runtime / slow-SQL 观测已转绿。
  闸门：完整 signed-in browser Board 验收、Google/email/OAuth 验证，以及 staging auth 下的一条 live provider smoke。

S1C Auth/registration         72%  [##############------]
  已稳定：Clerk frontend shell、FastAPI bearer verification、authorized-party checks、first-session personal wallet、admin bootstrap，以及真实 staging session/admin smoke。
  闸门：Google/email 流程验证、session revocation/logout hardening，以及更广 signed-in browser 验收。

S1D Board/share/invites       73%  [###############-----]
  已稳定：Board CRUD、owner-only copy/delete、share expiry、public view、member first pass、workspace invite backend contracts，以及带 owner/admin/member gating 的 Team/Group role UI first pass。
  闸门：billing-visibility separation、explicit Asset sharing、invite email delivery。

S1E Board packages            05%  [#-------------------]
  已稳定：`.tgy` package 决策、产品 / 架构合同，以及现有 Konva Board JSON + Asset 基础。
  闸门：package writer/reader、asset binary bundling、import rehydration、asset-id rewrite、UI actions 和 package safety tests。

S2 AI runtime/provider routes 68%  [##############------]
  已稳定：model/route/pricing tables、quote/preflight、persisted AiRun shell、admin facts、durable `text_output`、message-native chat backendization、四模型生图刷新和 240s 生图超时边界。
  闸门：staging live image smoke、更广 live-provider coverage，以及彻底退出对本地 AI fast path 的生产依赖。

S3 Admin/billing/team         96%  [###################-]
  已稳定：server-gated admin、active-tab server bootstrap、idle-warmed client tab keepalive、分页 Team/Group dashboards、table-first AI route management、AI route/pricing panels、Team checkout/top-up、Collaborate checkout、hosted checkout response contract、provider-neutral checkout adapter、signed webhook inbox、workspace invite/member contracts、payer settlement contracts、billing return routes、admin finance reconciliation、audited manual admin operations、operator User inventory/detail read model、五标签 user detail、centered manual-finance modals、native user status/delete、native subscription freeze/unfreeze、任意 Team/Group 的 invite/add-member actions、可搜索的 Join Team/Join Group detail modals、inline pending invite rows、invite/member/board mutation 的本地 detail patching、board copy/delete actions、统一的 payment/ledger/subscription/audit billing history rows，以及本地可选的 dense operator QA demo seed。
  闸门：重新部署当前 Web/API 到 staging 后重跑真实登录态 remote admin finance smoke、provider-specific signatures、renewal automation、invoices、refunds 和更深 route health views。

Frontend product UI alignment 63%  [#############-------]
  已稳定：workspaces、boards、billing、team、usage、admin、canvas node surfaces、带角色门控的 Team/Group member actions、第一阶段 Billing actions、admin finance reconciliation panels，以及 operator 行内 invite/member/board 操作回路已存在。
  闸门：统一 navigation、empty states、role language、plan labels 和 AI cost messaging。

S4 Collaboration              27%  [#####---------------]
  已稳定：本地 Yjs document/awareness、provider 形态 room transport，以及 reconnect/resync smoke harness 已存在。
  闸门：Auth、Board、Asset、AiRun authority 稳定后的 Yjs/provider proof。
```

依赖视图：

```text
S1B Deploy + S1C Auth
  -> S1D Board/workspace permission
       -> S2 AiRun permission + credit preflight
       -> S3 Team/Group visibility + billing/admin facts

S1X Konva canvas
  -> Node Registry + runtimeGraph
       -> S2 server AiRun lifecycle
       -> Asset refs back into Board-safe node outputs
       -> S1E `.tgy` package export/import asset rehydration

S2 Model/Route/Pricing control plane
  -> Provider adapter selection
  -> Credit/provider-cost settlement
  -> S3 Admin runtime and finance observability

Frontend UI alignment 横跨所有线，应该跟随服务端权威边界，不能自己发明权限和计费规则。
```

## 架构切片索引

| 切片 | 文件 | 负责内容 | 更新时机 |
| --- | --- | --- | --- |
| S0 Local Polish | `Finished/ARCH_slice_S0_local_polish.md` | Product shell、Workspace、Board save/history、Canvas Settings、Smart Drawing、Board Management、Canvas controls | 已完成 baseline；仅作为 regression reference |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI、Postgres、R2/S3、migrations、Auth、real Board CRUD、deployment | 活跃 umbrella；详细事实放在 S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema、Alembic migrations、constraints、indexes、future-compatible join points | S1A core 已通过 `0006` 实现；当前 head 还包含 S3 entitlement extension `0007` |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel、FastAPI host、Postgres、R2、domain、email provider、staging smoke | Web/API/Neon/R2 smoke 已通过；Auth/email/OAuth/Konva redeploy smoke 待完成 |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration、login、sessions、request context、workspace membership authority | Clerk/FastAPI bearer 第一阶段已落地；仍需 hardening |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | 稳定第一阶段 CRUD/member/share/public-share-open checkpoint，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard |
| S1E Board Packages | `ARCH_slice_S1E_board_packages.md` | `.tgy` package format、export/import flow、asset rewrite 和 package safety boundary | 已规划；基于 Konva Board serializer、Board guard 和 Asset APIs |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | 旧画布迁移收口、Konva/Yjs 替换路径 | Konva-only formal Board route 已接受；Page polish 和 legacy-doc safety 已落地；collaboration 仍待完成 |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry、Model Registry、AiRun、provider routing、AI Chat planner | Mock/runtime dataflow 和本地 GeekAI canvas path 现在已经证明用户侧 image/analysis/chat flow；DB-backed 模型档位 / 定价 / 线路、quote/preflight、持久化 lifecycle、按尝试分行的 `ai_api_calls`、timeout-safe failover，以及抽离出的 settlement orchestration 已存在；production gate 是把 GeekAI 和未来 providers 收口到服务端 provider-route control plane，并完成 live smoke 和 durable text output |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles、audit、Team wallets、personal Collaborate wallets、credits、subscriptions、workspace dashboards、AI charge facts、analytics、moderation facts | 活跃调整：migration `20260508_0012/0013`、payer resolver、settlement contracts、Team/Collaborate checkout、provider-neutral checkout adapter、signed webhook inbox、workspace invite/member contracts、usage checkout buttons、active-tab server bootstrap、idle-warmed client tab keepalive、分页 Team/Group dashboards、AI route metrics、table-first AI route management、admin finance reconciliation panels、manual admin operations、operator inventory/detail read model、native user status/delete、native subscription freeze/unfreeze、任意 Team/Group 的 invite/add-member writes、可搜索的 Join Team/Join Group detail modals、inline pending invite rows、invite/member/board mutation 的本地 detail patching、board copy/delete writes 和本地 disposable-Postgres admin/payment smoke 已在 Stripe 不可用时支持 Team wallet vs personal Collaborate wallet；remote staging redeploy smoke 以及 invoice/refund 深度仍待完成 |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer、presence、CRDT boundaries、roles | 推迟到 P0.5；Auth、Board、Asset 和 AiRun authority 稳定后再开始 collaboration work |

## 项目架构总览

```text
Browser
  |
  v
Next.js Web App
  |-- Product Shell routes
  |     |-- / public homepage
  |     |-- /workspaces protected workspace shell
  |     |-- /share/[shareId] public shared-Board entry
  |     |-- /admin server-gated first-pass management surface
  |-- Canvas Runtime
  |     |-- /boards/[boardId] formal Board shell
  |     |-- Konva v2 primary Board runtime
  |-- Board / Asset / AI clients
  |
  +-- local Next API bridge --------------+
  |                                       |
  v                                       v
FastAPI API ----------------------> Storage Adapters
  |                                  |-- PostgreSQL: users/workspaces/boards/history/assets/ai/admin
  |                                  |-- R2/S3-compatible: image binaries/thumbnails
  |                                  |-- local-dev filesystem adapters
  |
  v
External Providers
  |-- AI image/text providers
  |-- Email provider
  |-- Payment provider
```

## P0 Alpha 架构主线

当前这一轮，只有下面这些架构线属于发布关键路径：

1. Landing/Auth/workspace/Board/share 的路由边界
2. Konva-only Board 持久化以及 page/history 安全性
3. 一条带 payer preflight 和 Team/personal wallet settlement 的 server-side AiRun/provider execution 路径
4. 有限的 billing 可见性，加上 server-gated admin/operator 路由

对应的架构含义：

- collaboration transport、live presence 和 CRDT room sync 继续延后。
- external payment-provider automation 继续延后。
- placeholder product routes 可以继续存在于代码中，但不能继续主导整体架构叙事。

## 源码树与文档索引

```text
apps/web
  src/app                 Next routes and local API bridge
  src/components/canvas   退役的 pre-Konva 画布代码，仅保留作历史对照
  src/components/konva-canvas
                          Konva primary canvas runtime, stage, tools, nodes, save/history
  src/components/workspaces
  src/features/boards     Board documents, engine detection, metadata, History, client contracts
  src/features/canvas-engine
                          renderer-neutral CanvasDocument, geometry and shape contracts
  src/features/assets     Asset upload, thumbnails, runtime migration
  src/features/node-runtime
                          Node Registry, runtime graph and mock run adapter
  src/features/ai         Model Registry and AiRun client contracts
  src/features/auth       Session/request-context scaffold
  src/features/admin      Admin probe, routes and first-pass role-management client

services/api
  tangent_api             FastAPI app, routers, schemas, storage adapters
  migrations              Alembic P0 migration scaffold
  scripts                 bootstrap helpers such as first-pass admin owner grant
  tests                   API contract tests

PRD                       Product requirement slices
ARCH                      Architecture slices
project_state             Current progress and handoff slices
dev-plans                 Active implementation plans and historical archive
```

规范文档职责：

| 文件夹/文件 | 角色 | 索引文件 | 切片模式 |
| --- | --- | --- | --- |
| `PRD/` | 用户可见产品需求和验收 | `PRD/PRD.md` | `PRD/PRD_slice_*.md` |
| `ARCH/` | 架构边界、图、API 和 schema | `ARCH/ARCH.md` | `ARCH/ARCH_slice_*.md` |
| `project_state/` | 当前进度、交接状态和下一步 | `project_state/project_state.md` | `project_state/project_state_slice_*.md` |
| `dev-plans/` | 战术实施计划和 runbooks | `dev-plans/README.md` | 带日期的 plan 文件，归档在 `dev-plans/Archive/` |

当前活跃战术参考：

| Plan | 用途 |
| --- | --- |
| `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md` | 当前 P0 alpha 发布主线和验收闸门 |
| `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` | 把 GeekAI 和未来 providers 收口到服务端 AiRun route switching、credit settlement 和 admin observability |
| `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md` | 围绕快速 User inventory、one-call user detail bundle、modal operations 和 role-aware Team/Group management 重做 `/admin` |
| `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Team wallet、personal Collaborate wallet、invites、seats、membership、billing usage 和 payer resolver |
| `dev-plans/s3-billing-team-entitlements-strategy-2026-05-06.md` | 已被取代的市场基准和历史定价参考 |

本架构文件中仍出现的已完成/参考内容：

| 内容 | 当前标签 | 保留原因 |
| --- | --- | --- |
| S0 local alpha / local polish | 已完成 baseline | 仅作为 regression reference；不要重新打开为当前架构范围 |
| Legacy Tldraw documents/history | active app path 中阻止 | 防止 silent mixed-engine restore，同时保留迁移历史可解释性 |
| 旧单主干阶段图 | 已完成/reference flow | 用于解释历史依赖；当前规划使用本文顶部的平行泳道 |
| 旧 `ARCH/00-current-map.md` mirror | 已退役 | 当前 `ARCH/ARCH.md` 是唯一 canonical map |

## Canvas Engine 平行架构

S1X 现在在活跃 Web app 中运行 Konva-only Board 路径。历史上的 Tldraw 行为仍可作为迁移背景，但运行边界、路由行为和持久化合同现在都由 Konva 拥有。

```text
Browser route
  |
  +-- /boards/[boardId]
  |     |
  |     +-- load existing Board document unless ?new=1
  |     |
  |     +-- boardCanvasEngine detector
  |           |
  |           +-- Konva v2 envelope
  |           |     { version: 2, renderer: "konva", activePageId, pages, canvasDocument, canvasSettings, assets }
  |           |       |
  |           |       v
  |           |     KonvaCanvasSpike
  |           |       |-- KonvaCanvasStage
  |           |       |-- KonvaCanvasToolbar + Properties + Settings + Pages panel
  |           |       |-- Konva runtime edges / nodes / image operations
  |           |       |-- KonvaBoardSaveAudit
  |           |       v
  |           |     Board API save/load/history/thumbnail
  |           |
  |           +-- legacy v1 或 unknown document
  |           |       |
  |           |       +-- blocked unsupported state
  |           |       +-- active app path 中不再有隐式 runtime fallback
  |           |
  |           +-- new or missing Board
  |           |       |
  |           |       v
  |           |     blank Konva v2 Board
  |           |
  |           +-- unknown document
  |                   |
  |                   v
  |                 unsupported state; never auto-open blank and overwrite
  |
  +-- /share/[shareId]
        |
        +-- resolve stored share link
        +-- load shared Board document through share token
        +-- open Konva v2 Board in read-only viewer mode
```

Runtime ownership：

| 关注点 | Konva v2 production path | Legacy/migration handling | Shared boundary |
| --- | --- | --- | --- |
| Route | `/boards/[boardId]` 用于 owned/member Boards，`/share/[shareId]` 用于 public view-only shared Konva Boards | `/spikes/konva-canvas` 只是 dev-only regression surface；legacy docs 在 active routes 中会被阻止 | Board shell 和 workspace/share entry points |
| Persistence | Konva v2 envelope、Board API、History、thumbnail | Legacy v1 document read/reference only | Board guard prevents unsafe overwrite |
| Editing | Shape/image/node editing、crop、export/capture、runtime edges | 迁移期间作为行为参考 | Renderer-neutral CanvasDocument target |
| Settings | Konva toolbar gear + shared Canvas Settings panel | 只保留现有 reference settings | User-facing settings vocabulary |
| Assets | Image/capture/cutout URLs 和 compact refs only | 仅 reference import behavior | Asset API/object storage |
| AI nodes | Node Registry + runtimeGraph mock run adapter | 仅 reference interaction patterns | 未来 server-side AiRun contract |
| Collaboration | Pending Yjs/provider proof | 不是 production dependency | S4 等待稳定 Board/Asset/Auth/AiRun |

Persisted document flow：

```text
Konva interactions
  |
  v
CanvasDocument
  |-- shapes: rect/ellipse/line/arrow/draw/text/frame/sticky/image/node_card
  |-- runtimeEdges: renderer-neutral node dataflow edges
  |-- camera + metadata
  |
  +-- activePageId + pages[] envelope contract
  |     |-- canvasDocument remains active page mirror
  |     |-- Pages panel writes active page before save/switch/snapshot/page mutations
  |     |-- Page drawer delete/reorder + context-menu Move to page
  |
  +-- canvasSettings store
  |
  v
serializeKonvaBoardDocument()
  |
  v
Konva v2 envelope
  |
  +-- frontend board guard
  +-- FastAPI board guard
  |     |-- no data:/blob:/large Base64
  |     |-- schema-aware konva-v2 validation
  |     |-- runtime edge shape reference validation
  |
  v
Board storage
  |-- Board document JSON
  |-- Board History snapshots
  |-- thumbnail Asset reference
  |
  v
Restore
  |
  +-- validate envelope
  +-- replace CanvasDocument/camera/settings
  +-- clear transient selection/edit/crop/menu state
```

Asset 和 AI runtime 边界：

```text
Images / captures / cutouts / thumbnails
  -> Asset API / object storage
  -> Board JSON stores asset ids, URLs, dimensions and compact refs only

Prompt/Image/Analysis/Image Gen nodes
  -> Node Registry + runtimeGraph
  -> mock Run adapter today
  -> future server-side AiRun contract before real provider calls
```

Feature development flow：

```text
New canvas feature
  |
  +-- product requirement changes
  |       -> PRD slice
  |
  +-- renderer-neutral data change?
  |       -> CanvasDocument / Node Registry / Board guard
  |
  +-- Konva runtime implementation
  |       -> components/konva-canvas + feature module tests
  |
  +-- Asset or AI side effect?
  |       -> Asset API or server-side AiRun contract
  |
  +-- tldraw behavior useful as reference?
          -> compare manually, do not add new tldraw-only product dependency
```

## Group/Team Workspace + AI Charging 架构

商业系统被刻意拆成四个独立事实，避免权限跨层泄漏：

```text
Plan tier
  free_canvas | collaborate_start | collaborate_plus | team_start | team_growth | enterprise

Workspace kind
  solo_workspace | group_workspace | team_workspace | enterprise_workspace

Workspace / Board authority
  workspace owner/admin/member/guest
  board owner/admin/editor/viewer/temporary_viewer

AI payer
  actor_personal by default
  workspace_pool only for explicit enterprise contracts
```

Runtime flow：

```text
AI Run request
  |
  v
Request Context
  actor_user_id + workspace_id + workspace_kind + board_id
  |
  v
Permission Resolvers
  WorkspaceAccessService
  BoardPermissionService
  DashboardVisibilityService
  |
  v
Entitlement Resolvers
  SeatEntitlementService
  CreditAccountService
  AiChargePreflightService
  |
  v
Server-side AiRun
  ai_runs + ai_api_calls + credit_ledger + api_cost_ledger
  |
  v
User/Admin Surfaces
  personal billing
  Group basic dashboard
  Team member-usage dashboard
  global /admin developer console
```

UI ownership：

```text
Group Workspace
  Boards / members / invites / roles
  basic structural dashboard
  no member-level billing visibility

Team Workspace
  same Board/member controls
  plus per-member AI usage, total usage, expiry, seat and Board inventory

Global /admin
  server-gated admin_roles
  users / workspaces / Boards / subscriptions / ledger / AiRuns / provider calls / audit
```

## 已完成 / 参考阶段流程

这条已完成 / 参考流程展示的是原始依赖阶梯。它保留在这里用于解释为什么 S1 identity / ownership 会约束 S2/S3/S4，但当前规划应以本文顶部的平行泳道为准。

```text
S0 Accepted local alpha
  |
  v
S1 Real Boundary: staging + Auth + ownership + Board CRUD
  |
  +--> S1A DB schema + Alembic migrations
  |       users / workspaces / members / boards / snapshots / assets / auth facts
  |
  +--> S1B Staging infra smoke
  |       FastAPI health / Postgres / R2 / domain / CORS / Web API base URL
  |
  +--> S1X Canvas engine migration spike
  |       Konva v2 formal Board route、legacy-document guard，并继续验证 Yjs 路径
  |
  +--> S1C Auth + request context
  |       register / login / logout / session / default workspace
  |
  +--> S1D Auth-backed Board CRUD
          list / open / save / history / copy / delete / members / share / public share view
          |
          +----------------------+----------------------+----------------------+
                                 |                      |                      |
                                 v                      v                      v
                         S2 AI Runtime          S3 Admin/Billing        S4 Collaboration
                         provider calls         users/credits/revenue   presence/roles/live sync
                         AiRun/cost logs        Group/Team dashboards   conflict/history rules
                                                analytics/moderation
```

依赖规则：

- S1A 已在本地实现；在 S1B 期间需要用真实 Postgres 验证。
- S1B 需要 staging Postgres/R2/domain/API resources。
- S1C 依赖 S1A 和 email/session strategy。
- S1D 依赖 S1A/S1C，并成为 S2/S3/S4 的权限基础。
- S1D 现在包含 first-pass public share entry、share-token Board open、backend `none/view/edit/manage/owner` resolution、owner-only copy/delete、share expiry 和 known-foreign Asset reference blocking；更丰富的 Group/Team workspace separation 和明确的 Asset-sharing allowlists 仍然是未来工作。
- S2 应使用来自 S1 的真实 `user_id`、`workspace_id`、`board_id`，再开始扣 credits 或写 provider logs。
- S3 现在有第一阶段 server-gated `/admin` surface，以及可复用的 billing/team/usage 脚手架；但当前架构闸门是真实 Admin/Credits/Billing 作为生产权威之前，先完成 Team wallet + personal Collaborate wallet 的 payer pivot。
- S1X 当前提供 Konva-only Board runtime；它仍然需要 collaboration/Yjs proof 才能进入 S4。
- S4 必须等待 S1 permissions 和稳定的 Board/Asset/History contracts。
- 当前跨切片 handoff 和 acceptance checklist 位于 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`。
- 不要把未提交的 S1X Page polish 和 backend/database/Admin/AI implementation changes 混在一起；先提交已接受 checkpoint。

## 不可协商边界

- Board documents、Board History documents、node props 和未来 collaboration docs 不能持久化 `data:`、`blob:`、Base64 images、provider raw responses、complete logs 或 long generated text。
- Image binaries 和 thumbnails 属于 object storage；documents 只存 URLs / Asset ids。
- Production Board runtime 默认必须是 Konva v2；legacy Board 文档会被阻止，而不是打开任何 fallback runtime。
- AI provider calls 只在服务端执行，并通过 Model Registry + AiRun contracts。
- Admin permissions 通过服务端 `admin_roles`；frontend role flags 不是 authority。
- 真实 collaboration 等到 Asset、Board、Auth 和 AiRun boundaries 稳定后再做。
- Source files 目标低于 300 行；在已经很大的文件上加行为前先拆分。

## 更新规则

- 活跃开发期间，更新相关 `ARCH_slice_*.md`。
- 只有当 slice status、lane、core boundary 或 file architecture 变化时才更新这个索引。
- 根目录 `ARCH.md` 只做 pointer。
- 不要维护 `00-current-map.md` 这类 mirror files；本文件就是 map。
