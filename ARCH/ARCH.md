# TANGENT Architecture Index

**Updated**: 2026-05-06
**Status**: Canonical architecture overview and slice index, now reflecting S1D public share plus effective-permission / owner-only copy-delete / known-foreign Asset guard hardening, S3 admin bootstrap first pass and the documented Group/Team workspace + actor-personal AI charging boundary.

This file replaces the former duplicated `ARCH/00-current-map.md` plus the long root `ARCH.md`. The root `ARCH.md` is now only a pointer.

## System Overview

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

## Source Tree Map

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

## Parallel Development Lanes

Milestone labels are now preferred over fake precision. S0 local polish is archived as an accepted baseline; S1/S2/S3 show the next boundary that still changes implementation behavior.

```text
                 +-----------------------------+
                 | Current baseline accepted   |
                 | S0 Product shell + Board    |
                 +--------------+--------------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v--------+      +-------v--------+      +-------v--------+
| Local Polish   |      | Real Boundary  |      | AI Runtime     |
| S0             |      | S1             |      | S2             |
+-------+--------+      +-------+--------+      +-------+--------+
        |                       |                       |
| Product shell [accepted] | DB schema [core done] | Model Registry [mock]
| Board save UX [accepted] | Staging infra [smoke] | AiRun/logs [mock]
| Board History [accepted] | Auth boundary [first pass] | Provider route [not wired]
| Canvas Settings [accepted] | Board CRUD/share [first pass] | AI Chat planner [mock]
| Board Mgmt [accepted] | Postgres/R2 [smoke]    |
| Canvas controls [accepted] | Canvas Engine S1X [route accepted] |
| Captured thumb [accepted]  |
| Smart Drawing [accepted]   |
        |                       |                       |
        +-----------+-----------+-----------+-----------+
                    |                       |
             +------v------+        +------v------+
             | Admin/Bill  |        | Collab P0.5 |
             | S3 first pass|       | S4 deferred |
             +-------------+        +-------------+
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

## Architecture Slice Index

| Slice | File | Owns | Update when |
| --- | --- | --- | --- |
| S0 Local Polish | `Finished/ARCH_slice_S0_local_polish.md` | Product shell, Workspace, Board save/history, Canvas Settings, Smart Drawing, Board Management, Canvas controls | Finished baseline; regression reference only |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI, Postgres, R2/S3, migrations, Auth, real Board CRUD, deployment | Active umbrella; keep detailed truth in S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema, Alembic migrations, constraints, indexes, future-compatible join points | S1A core implemented through `0006`; current head also includes S3 entitlement extension `0007` |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel, FastAPI host, Postgres, R2, domain, email provider, staging smoke | Web/API/Neon/R2 smoke passed; Auth/email/OAuth/Konva redeploy smoke pending |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration, login, sessions, request context, workspace membership authority | Clerk/FastAPI bearer first pass landed; hardening remains |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | Stable first-pass CRUD/member/share/public-share-open checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk, current canvas reference contract, Konva/Yjs replacement path | Konva v2 formal Board route accepted; Page polish and v1 copy tooling landed; collaboration still pending |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | Mock runtime plus optional mock-ledger charging exercise exists; DB-backed model tiers/pricing/routes, quote/preflight, persisted mock create/poll/cancel lifecycle, attempt-level `ai_api_calls`, timeout-safe failover and extracted settlement orchestration now sit in the first-pass backend checkpoint; real provider execution remains pending |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, credits, subscriptions, Group/Team workspace dashboards, AI charge facts, analytics, moderation facts | First-pass `/admin` summary/audit/role-management landed; billing/workspace entitlement routes, Team seat mutation, credit read/preflight, internal ledger settlement helpers, read-only `/admin/ai/runs` and `/admin/ai/api-calls` runtime views, plus a first-pass frontend `/admin` AI dashboard with grouped attempt timelines, and the planned developer AI pricing/route control plane are now documented; real billing/payment/provider settlement still pending |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer, presence, CRDT boundaries, roles | Collaboration work begins |

## Stage Flow

S1 is the next trunk. S2/S3/S4 can be designed in parallel, but implementation should not outrun the identity and ownership facts created in S1.

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
- S3 now has a first-pass server-gated `/admin` surface, and the billing slice now defines Group/Team dashboard visibility plus actor-personal AI charging, but real Admin/Credits/Billing still needs S1 identity and S2 cost facts.
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

**更新日期**：2026-05-06
**状态**：规范架构总览和切片索引，当前反映 S1D 公共分享加 effective-permission / owner-only copy-delete / known-foreign Asset guard hardening、S3 admin bootstrap 第一阶段，以及已文档化的 Group/Team workspace + actor-personal AI charging 边界。

本文件取代原来的重复 `ARCH/00-current-map.md` 和根目录长 `ARCH.md`。根目录 `ARCH.md` 现在只做指针用途。

## 系统总览

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

## 源码树地图

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

## 平行开发泳道

现在优先使用里程碑标签，而不是虚假的精确百分比。S0 local polish 已作为接受的 baseline 归档；S1/S2/S3 显示的是仍会改变实现行为的下一条边界。

```text
                 +-----------------------------+
                 | Current baseline accepted   |
                 | S0 Product shell + Board    |
                 +--------------+--------------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v--------+      +-------v--------+      +-------v--------+
| Local Polish   |      | Real Boundary  |      | AI Runtime     |
| S0             |      | S1             |      | S2             |
+-------+--------+      +-------+--------+      +-------+--------+
        |                       |                       |
| Product shell [accepted] | DB schema [core done] | Model Registry [mock]
| Board save UX [accepted] | Staging infra [smoke] | AiRun/logs [mock]
| Board History [accepted] | Auth boundary [first pass] | Provider route [not wired]
| Canvas Settings [accepted] | Board CRUD/share [first pass] | AI Chat planner [mock]
| Board Mgmt [accepted] | Postgres/R2 [smoke]    |
| Canvas controls [accepted] | Canvas Engine S1X [route accepted] |
| Captured thumb [accepted]  |
| Smart Drawing [accepted]   |
        |                       |                       |
        +-----------+-----------+-----------+-----------+
                    |                       |
             +------v------+        +------v------+
             | Admin/Bill  |        | Collab P0.5 |
             | S3 first pass|       | S4 deferred |
             +-------------+        +-------------+
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

## 架构切片索引

| 切片 | 文件 | 负责内容 | 更新时机 |
| --- | --- | --- | --- |
| S0 Local Polish | `Finished/ARCH_slice_S0_local_polish.md` | Product shell、Workspace、Board save/history、Canvas Settings、Smart Drawing、Board Management、Canvas controls | 已完成 baseline；仅作为 regression reference |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI、Postgres、R2/S3、migrations、Auth、real Board CRUD、deployment | 活跃 umbrella；详细事实放在 S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema、Alembic migrations、constraints、indexes、future-compatible join points | S1A core 已通过 `0006` 实现；当前 head 还包含 S3 entitlement extension `0007` |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel、FastAPI host、Postgres、R2、domain、email provider、staging smoke | Web/API/Neon/R2 smoke 已通过；Auth/email/OAuth/Konva redeploy smoke 待完成 |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration、login、sessions、request context、workspace membership authority | Clerk/FastAPI bearer 第一阶段已落地；仍需 hardening |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | 稳定第一阶段 CRUD/member/share/public-share-open checkpoint，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk、current canvas reference contract、Konva/Yjs replacement path | Konva v2 formal Board route 已接受；Page polish 和 v1 copy tooling 已落地；collaboration 仍待完成 |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry、Model Registry、AiRun、provider routing、AI Chat planner | Mock runtime 加 optional mock-ledger charging exercise 已存在；DB-backed 模型档位 / 定价 / 线路、quote/preflight、持久化的 mock create/poll/cancel lifecycle、按尝试分行的 `ai_api_calls`、timeout-safe failover，以及抽离出的 settlement orchestration 现在都已进入第一阶段后端检查点；真实 provider execution 仍待完成 |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles、audit、credits、subscriptions、Group/Team workspace dashboards、AI charge facts、analytics、moderation facts | 第一阶段 `/admin` summary/audit/role-management 已落地；billing/workspace entitlement routes、Team seat mutation、credit read/preflight、internal ledger settlement helpers、只读 `/admin/ai/runs` 和 `/admin/ai/api-calls` runtime views、带 grouped attempt timeline 的第一阶段前端 `/admin` AI dashboard，以及规划中的开发者 AI 定价 / 线路控制平面现已文档化；真实 billing/payment/provider settlement 仍待完成 |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer、presence、CRDT boundaries、roles | Collaboration work begins |

## 阶段流程

S1 是下一条主干。S2/S3/S4 可以并行设计，但实现不应该跑在 S1 创建的 identity 和 ownership facts 前面。

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
- S3 现在有第一阶段 server-gated `/admin` surface，并且 billing slice 已定义 Group/Team dashboard visibility 和 actor-personal AI charging，但真实 Admin/Credits/Billing 仍然需要 S1 identity 和 S2 cost facts。
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
