# TANGENT Architecture Index

**Updated**: 2026-05-08
**Status**: Canonical architecture overview and slice index, now aligned with the current parallel P0 alpha workstreams and the S3 pivot: Team workspaces use Team wallets, while Group/Collaborate uses personal wallets.

This file replaces the former duplicated `ARCH/00-current-map.md` plus the long root `ARCH.md`. The root `ARCH.md` is now only a pointer.

## Parallel Development Swimlane

The original single-trunk diagram is no longer enough because Auth/deploy, Board permissions, Team/Group billing, AI provider routing, admin tooling and frontend node UI are now moving in parallel. The percentages below are coarse architecture-readiness markers as of 2026-05-08. They are not time estimates; they show whether a lane has a usable first pass, a server authority boundary and a remaining production gate.

```text
Current architecture readiness snapshot

S1X Canvas/Konva runtime      78%  [###############-----]
  Stable: Konva v2 Board route, pages, nodes, runtime edges, save/history/share view.
  Gate: rendered page thumbnails, export/background polish, real AiRun adapter, Yjs proof.

S1A Schema/DB foundation      82%  [################----]
  Stable: core user/workspace/board/asset/admin/AI/credit join points and migrations.
  Gate: staging migration/query smoke after the Team-wallet schema delta.

S1B Deploy/staging            60%  [############--------]
  Stable: public Web/API/Neon/R2 smoke path.
  Gate: Auth/email/OAuth, Konva-first redeploy, production-like Web/API origin contract, secret and CORS pass.

S1C Auth/registration         55%  [###########---------]
  Stable: Clerk frontend shell, FastAPI bearer first pass, remote client token attach.
  Gate: highest-priority backend cut is real-login admin access, admin_roles bootstrap, spoof tests, CORS/origin contract and first-session personal wallet creation.

S1D Board/share/invites       73%  [###############-----]
  Stable: Board CRUD, owner-only copy/delete, share expiry, public view, member first pass, workspace invite backend contracts and Team/Group role UI first pass with owner/admin/member gating.
  Gate: billing-visibility separation, explicit Asset sharing, invite email delivery.

S1E Board packages            05%  [#-------------------]
  Stable: `.tgy` package decision, product/architecture contract and existing Konva Board JSON plus Asset foundations.
  Gate: package writer/reader, asset binary bundling, import rehydration, asset-id rewrite, UI actions and package safety tests.

S2 AI runtime/provider routes 56%  [###########---------]
  Stable: model/route/pricing tables, quote/preflight, persisted AiRun shell, admin facts.
  Gate: fold local GeekAI path into provider-route adapter, hosted live Team-wallet settlement smoke, text persistence.

S3 Admin/billing/team         83%  [#################---]
  Stable: server-gated admin, admin directory APIs for users/Teams/Groups, tabbed developer console, AI route metrics, AI route/pricing panels, Team checkout/top-up, Collaborate checkout, hosted checkout response contract, provider-neutral checkout adapter, Stripe Checkout Session first cut, signed webhook inbox with provider metadata lookup, Group create, workspace invite with Team seat policy, member removal contracts, payer settlement contracts, real usage checkout buttons, billing return routes, admin finance reconciliation for payments/wallets/subscriptions/ledger/member usage, audited manual admin top-up/plan/cancel operations, and local disposable-Postgres admin finance + manual/hosted payment smoke.
  Gate: role-specific admin UX polish, redeploy current Web/API to staging, run Alembic head before admin smoke, bootstrap/verify real admin_roles for the signed-in operator, rerun real-login remote admin finance smoke, provider-specific signatures, renewal automation, invoices, refunds and deeper route health views.

Frontend product UI alignment 60%  [############--------]
  Stable: workspaces, boards, billing, team, usage, tabbed admin console, canvas node surfaces, Team/Group role-gated member actions, first-pass Billing actions and admin finance reconciliation panels exist.
  Gate: align navigation, empty states, role language, plan labels and AI cost messaging.

S4 Collaboration              10%  [##------------------]
  Stable: collaboration boundary documented.
  Gate: Yjs/provider proof after Auth, Board, Asset and AiRun authority are stable.
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
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel, FastAPI host, Postgres, R2, domain, email provider, staging smoke | Web/API/Neon/R2 smoke passed; Auth/email/OAuth/Konva redeploy smoke pending |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration, login, sessions, request context, workspace membership authority | Clerk/FastAPI bearer first pass landed; hardening remains |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | Stable first-pass CRUD/member/share/public-share-open checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard |
| S1E Board Packages | `ARCH_slice_S1E_board_packages.md` | `.tgy` package format, export/import flow, asset rewrite and package safety boundary | Planned; uses Konva Board serializer, Board guard and Asset APIs as foundations |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk, current canvas reference contract, Konva/Yjs replacement path | Konva v2 formal Board route accepted; Page polish and v1 copy tooling landed; collaboration still pending |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | Mock/runtime dataflow and the local GeekAI canvas path now prove the user-facing image/analysis/chat flow; DB-backed model tiers/pricing/routes, quote/preflight, persisted lifecycle, attempt-level `ai_api_calls`, timeout-safe failover and extracted settlement orchestration exist; production gate is folding GeekAI and future providers into the server provider-route control plane with live smoke and durable text output |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, Team wallets, personal Collaborate wallets, credits, subscriptions, workspace dashboards, AI charge facts, analytics, moderation facts | Active pivot: migration `20260508_0012/0013`, payer resolver, settlement contracts, Team/Collaborate checkout, provider-neutral checkout adapter, signed webhook inbox, workspace invite/member contracts, usage checkout buttons, admin directory APIs, tabbed admin console, AI route metrics, admin finance reconciliation panels, manual admin top-up/plan/cancel controls and local disposable-Postgres admin/payment smoke now support Team wallet vs personal Collaborate wallet while Stripe is unavailable; remote staging redeploy smoke plus invoice/refund depth remain pending |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer, presence, CRDT boundaries, roles | Deferred to P0.5; collaboration work begins after Auth, Board, Asset and AiRun authority are stable |

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
  |     |-- tldraw v1 development reference, production-gated
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
2. Konva-first Board persistence and page/history safety
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
  src/components/canvas   shared canvas UI plus tldraw reference shell
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
| `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Team wallet, personal Collaborate wallet, invites, seats, membership, billing usage and payer resolver |
| `dev-plans/s3-billing-team-entitlements-strategy-2026-05-06.md` | Superseded market benchmark and historical pricing reference |

Completed/reference content that still appears in this architecture file:

| Content | Current label | Why it remains |
| --- | --- | --- |
| S0 local alpha / local polish | Completed baseline | Regression reference only; do not reopen as current architecture scope |
| tldraw v1 Board runtime | Reference-only, production-gated | Kept for behavior comparison during Konva migration; new product behavior lands on Konva |
| Old single-trunk stage diagram | Completed/reference flow | Useful historical dependency map, but current planning uses the parallel swimlane above |
| Former `ARCH/00-current-map.md` mirror | Retired | This `ARCH/ARCH.md` is the canonical map |

## Canvas Engine Parallel Architecture

S1X now runs a Konva-first Board path while retaining tldraw as a local reference. The production default must not depend on tldraw, and new product behavior should land on the Konva path first.

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
  |           +-- tldraw v1 document
  |           |       |
  |           |       +-- development/reference allowed: CanvasSpike
  |           |       +-- production default: disabled reference state
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

| Concern | Konva v2 production path | tldraw v1 reference path | Shared boundary |
| --- | --- | --- | --- |
| Route | `/boards/[boardId]` for owned/member Boards, `/share/[shareId]` for public view-only shared Konva Boards | `/spikes/canvas` and explicitly enabled reference fallback | Board shell and workspace/share entry points |
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
  |       Konva v2 formal Board route, tldraw reference gate, prove Yjs path later
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
- S1X currently provides the Konva-first Board runtime; it still needs collaboration/Yjs proof before S4.
- S4 must wait for S1 permissions and stable Board/Asset/History contracts.
- The current cross-slice handoff and acceptance checklist lives in `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`.
- Do not mix uncommitted S1X Page polish with backend/database/Admin/AI implementation changes; commit the accepted checkpoint first.

## Non-Negotiable Boundaries

- Board documents, Board History documents, node props and future collaboration docs must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text.
- Image binaries and thumbnails belong in object storage; documents store URLs/Asset ids only.
- Production Board runtime must be Konva v2 by default; tldraw is a reference route only unless explicitly enabled for development/migration.
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

**更新日期**：2026-05-08
**状态**：规范架构总览和切片索引，当前已对齐正在并行推进的 P0 alpha 工作流，以及 S3 调整：Team workspace 使用 Team wallet，Group/Collaborate 使用个人钱包。

本文件取代原来的重复 `ARCH/00-current-map.md` 和根目录长 `ARCH.md`。根目录 `ARCH.md` 现在只做指针用途。

## 平行开发泳道

原来的单主干图已经不够用了，因为 Auth/deploy、Board 权限、Team/Group billing、AI provider routing、admin tooling 和 frontend node UI 正在并行推进。下面的百分比是截至 2026-05-08 的粗颗粒架构就绪度，不是工时估算；它表示每条线是否已有可用第一阶段、服务端权威边界，以及还剩哪个 production gate。

```text
当前架构就绪度快照

S1X Canvas/Konva runtime      78%  [###############-----]
  已稳定：Konva v2 Board route、pages、nodes、runtime edges、save/history/share view。
  闸门：rendered page thumbnails、export/background polish、real AiRun adapter、Yjs proof。

S1A Schema/DB foundation      82%  [################----]
  已稳定：user/workspace/board/asset/admin/AI/credit 的核心 join points 和 migrations。
  闸门：Team-wallet schema delta 之后的 staging migration/query smoke。

S1B Deploy/staging            60%  [############--------]
  已稳定：public Web/API/Neon/R2 smoke path。
  闸门：Auth/email/OAuth、Konva-first redeploy、production-like secrets 和 CORS pass。

S1C Auth/registration         55%  [###########---------]
  已稳定：Clerk frontend shell、FastAPI bearer first pass、remote client token attach。
  闸门：完整 registration/session hardening、workspace membership matrix、spoof tests。

S1D Board/share/invites       73%  [###############-----]
  已稳定：Board CRUD、owner-only copy/delete、share expiry、public view、member first pass、workspace invite backend contracts，以及带 owner/admin/member gating 的 Team/Group role UI first pass。
  闸门：billing-visibility separation、explicit Asset sharing、invite email delivery。

S1E Board packages            05%  [#-------------------]
  已稳定：`.tgy` package 决策、产品 / 架构合同，以及现有 Konva Board JSON + Asset 基础。
  闸门：package writer/reader、asset binary bundling、import rehydration、asset-id rewrite、UI actions 和 package safety tests。

S2 AI runtime/provider routes 56%  [###########---------]
  已稳定：model/route/pricing tables、quote/preflight、persisted AiRun shell、admin facts。
  闸门：把 local GeekAI path 收口进 provider-route adapter、hosted live Team-wallet settlement smoke、text persistence。

S3 Admin/billing/team         80%  [################----]
  已稳定：server-gated admin、AI route/pricing panels、Team checkout/top-up、Collaborate checkout、hosted checkout response contract、provider-neutral checkout adapter、Stripe Checkout Session first cut、signed webhook inbox with provider metadata lookup、Group create、workspace invite with Team seat policy、member removal contracts、payer settlement contracts、real usage checkout buttons、billing return routes、payments/wallets/subscriptions/ledger/member usage 的 admin finance reconciliation、audited manual admin top-up/plan/cancel operations，以及本地 disposable-Postgres admin finance + manual/hosted payment smoke。
  闸门：重新部署当前 Web/API 到 staging 后重跑真实登录态 remote admin finance smoke、provider-specific signatures、renewal automation、invoices、refunds 和更深 route health views。

Frontend product UI alignment 58%  [############--------]
  已稳定：workspaces、boards、billing、team、usage、admin、canvas node surfaces、带角色门控的 Team/Group member actions、第一阶段 Billing actions 和 admin finance reconciliation panels 已存在。
  闸门：统一 navigation、empty states、role language、plan labels 和 AI cost messaging。

S4 Collaboration              10%  [##------------------]
  已稳定：collaboration boundary 已文档化。
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
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk、current canvas reference contract、Konva/Yjs replacement path | Konva v2 formal Board route 已接受；Page polish 和 v1 copy tooling 已落地；collaboration 仍待完成 |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry、Model Registry、AiRun、provider routing、AI Chat planner | Mock/runtime dataflow 和本地 GeekAI canvas path 现在已经证明用户侧 image/analysis/chat flow；DB-backed 模型档位 / 定价 / 线路、quote/preflight、持久化 lifecycle、按尝试分行的 `ai_api_calls`、timeout-safe failover，以及抽离出的 settlement orchestration 已存在；production gate 是把 GeekAI 和未来 providers 收口到服务端 provider-route control plane，并完成 live smoke 和 durable text output |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles、audit、Team wallets、personal Collaborate wallets、credits、subscriptions、workspace dashboards、AI charge facts、analytics、moderation facts | 活跃调整：migration `20260508_0012/0013`、payer resolver、settlement contracts、Team/Collaborate checkout、provider-neutral checkout adapter、signed webhook inbox、workspace invite/member contracts、usage checkout buttons、admin finance reconciliation panels、manual admin top-up/plan/cancel controls 和本地 disposable-Postgres admin/payment smoke 已在 Stripe 不可用时支持 Team wallet vs personal Collaborate wallet；remote staging redeploy smoke 以及 invoice/refund 深度仍待完成 |
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
  |     |-- tldraw v1 development reference, production-gated
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
2. Konva-first Board 持久化以及 page/history 安全性
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
  src/components/canvas   shared canvas UI plus tldraw reference shell
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
| `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Team wallet、personal Collaborate wallet、invites、seats、membership、billing usage 和 payer resolver |
| `dev-plans/s3-billing-team-entitlements-strategy-2026-05-06.md` | 已被取代的市场基准和历史定价参考 |

本架构文件中仍出现的已完成/参考内容：

| 内容 | 当前标签 | 保留原因 |
| --- | --- | --- |
| S0 local alpha / local polish | 已完成 baseline | 仅作为 regression reference；不要重新打开为当前架构范围 |
| tldraw v1 Board runtime | 仅参考、生产 gate | Konva 迁移期间用于行为对照；新产品行为落在 Konva |
| 旧单主干阶段图 | 已完成/reference flow | 用于解释历史依赖；当前规划使用本文顶部的平行泳道 |
| 旧 `ARCH/00-current-map.md` mirror | 已退役 | 当前 `ARCH/ARCH.md` 是唯一 canonical map |

## Canvas Engine 平行架构

S1X 现在运行 Konva-first Board 路径，同时保留 tldraw 作为本地参考。生产默认不能依赖 tldraw，新的产品行为应优先落在 Konva 路径。

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
  |           +-- tldraw v1 document
  |           |       |
  |           |       +-- development/reference allowed: CanvasSpike
  |           |       +-- production default: disabled reference state
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

| 关注点 | Konva v2 production path | tldraw v1 reference path | Shared boundary |
| --- | --- | --- | --- |
| Route | `/boards/[boardId]` 用于 owned/member Boards，`/share/[shareId]` 用于 public view-only shared Konva Boards | `/spikes/canvas` 和显式启用的 reference fallback | Board shell 和 workspace/share entry points |
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
  |       Konva v2 formal Board route, tldraw reference gate, prove Yjs path later
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
- S1X 当前提供 Konva-first Board runtime；它仍然需要 collaboration/Yjs proof 才能进入 S4。
- S4 必须等待 S1 permissions 和稳定的 Board/Asset/History contracts。
- 当前跨切片 handoff 和 acceptance checklist 位于 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`。
- 不要把未提交的 S1X Page polish 和 backend/database/Admin/AI implementation changes 混在一起；先提交已接受 checkpoint。

## 不可协商边界

- Board documents、Board History documents、node props 和未来 collaboration docs 不能持久化 `data:`、`blob:`、Base64 images、provider raw responses、complete logs 或 long generated text。
- Image binaries 和 thumbnails 属于 object storage；documents 只存 URLs / Asset ids。
- Production Board runtime 默认必须是 Konva v2；除非显式为 development/migration 开启，否则 tldraw 只是 reference route。
- AI provider calls 只在服务端执行，并通过 Model Registry + AiRun contracts。
- Admin permissions 通过服务端 `admin_roles`；frontend role flags 不是 authority。
- 真实 collaboration 等到 Asset、Board、Auth 和 AiRun boundaries 稳定后再做。
- Source files 目标低于 300 行；在已经很大的文件上加行为前先拆分。

## 更新规则

- 活跃开发期间，更新相关 `ARCH_slice_*.md`。
- 只有当 slice status、lane、core boundary 或 file architecture 变化时才更新这个索引。
- 根目录 `ARCH.md` 只做 pointer。
- 不要维护 `00-current-map.md` 这类 mirror files；本文件就是 map。
