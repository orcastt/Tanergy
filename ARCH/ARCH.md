# TANGENT Architecture Index

**Updated**: 2026-05-06
**Status**: Canonical architecture overview and slice index, now reflecting S1D public share first pass, S3 admin bootstrap first pass and the documented Group/Team workspace + actor-personal AI charging boundary.

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

Percentages mean distance to local/P0 alpha usefulness, not final commercial completeness. S0 local polish is accepted for P0 alpha; keep only regression fixes and shift new architecture work toward S1.

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
| Product shell [95%]   | DB schema [92%]      | Model Registry [35%]
| Board save UX [94%]   | Staging infra [85%]  | AiRun/logs [20%]
| Board History [95%]   | Auth boundary [40%]  | Provider route [0%]
| Canvas Settings [96%] | Board CRUD API [48%] | AI Chat planner [10%]
| Board Mgmt [93%]      | Postgres/R2 [90%]    |
| Canvas controls [96%] | Canvas Engine S1X [82%] |
| Captured thumb [91%]  |
| Smart Drawing [95%]   |
        |                       |                       |
        +-----------+-----------+-----------+-----------+
                    |                       |
             +------v------+        +------v------+
             | Admin/Bill  |        | Collab P0.5 |
             | S3 [30%]    |        | S4 [0%]     |
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
| S0 Local Polish | `ARCH_slice_S0_local_polish.md` | Product shell, Workspace, Board save/history, Canvas Settings, Smart Drawing, Board Management, Canvas controls | Accepted for P0 alpha; regression fixes only |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI, Postgres, R2/S3, migrations, Auth, real Board CRUD, deployment | Next active architecture slice: data/API/Auth/deploy changes |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema, Alembic migrations, constraints, indexes, future-compatible join points | Implemented and locally smoke-tested; staging DB smoke pending S1B |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel, FastAPI host, Postgres, R2, domain, email provider, staging smoke | When preparing online resources |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration, login, sessions, request context, workspace membership authority | After S1A |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | Stable first-pass CRUD/member/share/public-share-open checkpoint |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk, current canvas reference contract, Konva/Yjs replacement path | Konva v2 formal Board route accepted; Page polish and v1 copy tooling landed; collaboration still pending |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | AI node/provider/model changes |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, credits, subscriptions, Group/Team workspace dashboards, AI charge facts, analytics, moderation facts | First-pass `/admin` summary/audit/role-management landed; read-only billing/workspace entitlement routes, migration and AiRun payer fields now exist; real billing ledger still pending |
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
- S1D now includes first-pass public share entry and share-token Board open; richer `Can view/edit/manage/owner` plus Group/Team workspace separation still remain future work.
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
**状态**：规范架构总览和切片索引，当前反映 S1D 公共分享第一阶段、S3 admin bootstrap 第一阶段，以及已文档化的 Group/Team workspace + actor-personal AI charging 边界。

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

百分比表示距离本地 / P0 alpha 可用性的距离，不表示最终商业完整度。S0 local polish 已被 P0 alpha 接受；只保留 regression fixes，把新架构工作转向 S1。

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
| Product shell [95%]   | DB schema [92%]      | Model Registry [35%]
| Board save UX [94%]   | Staging infra [85%]  | AiRun/logs [20%]
| Board History [95%]   | Auth boundary [40%]  | Provider route [0%]
| Canvas Settings [96%] | Board CRUD API [48%] | AI Chat planner [10%]
| Board Mgmt [93%]      | Postgres/R2 [90%]    |
| Canvas controls [96%] | Canvas Engine S1X [82%] |
| Captured thumb [91%]  |
| Smart Drawing [95%]   |
        |                       |                       |
        +-----------+-----------+-----------+-----------+
                    |                       |
             +------v------+        +------v------+
             | Admin/Bill  |        | Collab P0.5 |
             | S3 [30%]    |        | S4 [0%]     |
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
| S0 Local Polish | `ARCH_slice_S0_local_polish.md` | Product shell、Workspace、Board save/history、Canvas Settings、Smart Drawing、Board Management、Canvas controls | 已接受为 P0 alpha；只做 regression fixes |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI、Postgres、R2/S3、migrations、Auth、real Board CRUD、deployment | 下一个活跃架构切片：data/API/Auth/deploy changes |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema、Alembic migrations、constraints、indexes、future-compatible join points | 已实现并完成本地 smoke；staging DB smoke 等待 S1B |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel、FastAPI host、Postgres、R2、domain、email provider、staging smoke | 准备在线资源时 |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration、login、sessions、request context、workspace membership authority | S1A 之后 |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member/share APIs | 稳定第一阶段 CRUD/member/share/public-share-open checkpoint |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk、current canvas reference contract、Konva/Yjs replacement path | Konva v2 formal Board route 已接受；Page polish 和 v1 copy tooling 已落地；collaboration 仍待完成 |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry、Model Registry、AiRun、provider routing、AI Chat planner | AI node/provider/model changes |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles、audit、credits、subscriptions、Group/Team workspace dashboards、AI charge facts、analytics、moderation facts | 第一阶段 `/admin` summary/audit/role-management 已落地；只读 billing/workspace entitlement routes、migration 和 AiRun payer fields 现在已存在；真实 billing ledger 仍待完成 |
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
- S1D 现在包含 first-pass public share entry 和 share-token Board open；更丰富的 `Can view/edit/manage/owner` 加 Group/Team workspace separation 仍然是未来工作。
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
