# TANGENT Architecture Index

**Updated**: 2026-05-05
**Status**: Canonical architecture overview and slice index.

This file replaces the former duplicated `ARCH/00-current-map.md` plus the long root `ARCH.md`. The root `ARCH.md` is now only a pointer.

## System Overview

```text
Browser
  |
  v
Next.js Web App
  |-- Product Shell routes
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

services/api
  tangent_api             FastAPI app, routers, schemas, storage adapters
  migrations              Alembic P0 migration scaffold
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
  v
/boards/[boardId]
  |
  +-- load existing Board document unless ?new=1
  |
  +-- boardCanvasEngine detector
        |
        +-- Konva v2 envelope
        |     { version: 2, renderer: "konva", activePageId, pages, canvasDocument, canvasSettings, assets }
        |       |
        |       v
        |     KonvaCanvasSpike
        |       |-- KonvaCanvasStage
        |       |-- KonvaCanvasToolbar + Properties + Settings
        |       |-- Konva runtime edges / nodes / image operations
        |       |-- KonvaBoardSaveAudit
        |       v
        |     Board API save/load/history/thumbnail
        |
        +-- tldraw v1 document
        |       |
        |       +-- development/reference allowed: CanvasSpike
        |       +-- production default: disabled reference state
        |
        +-- new or missing Board
        |       |
        |       v
        |     blank Konva v2 Board
        |
        +-- unknown document
                |
                v
              unsupported state; never auto-open blank and overwrite
```

Runtime ownership:

| Concern | Konva v2 production path | tldraw v1 reference path | Shared boundary |
| --- | --- | --- | --- |
| Route | `/boards/[boardId]` default for new/missing/Konva documents | `/spikes/canvas` and explicitly enabled reference fallback | Board shell and workspace entry points |
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
  |     |-- canvasDocument remains active page mirror for current single-page runtime
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
| Board History [95%]   | Auth boundary [35%]  | Provider route [0%]
| Canvas Settings [96%] | Board CRUD API [25%] | AI Chat planner [10%]
| Board Mgmt [93%]      | Postgres/R2 [90%]    |
| Canvas controls [96%] | Canvas Engine S1X [78%] |
| Captured thumb [91%]  |
| Smart Drawing [95%]   |
        |                       |                       |
        +-----------+-----------+-----------+-----------+
                    |                       |
             +------v------+        +------v------+
             | Admin/Bill  |        | Collab P0.5 |
             | S3 [20%]    |        | S4 [0%]     |
             +-------------+        +-------------+
```

## Architecture Slice Index

| Slice | File | Owns | Update when |
| --- | --- | --- | --- |
| S0 Local Polish | `ARCH_slice_S0_local_polish.md` | Product shell, Workspace, Board save/history, Canvas Settings, Smart Drawing, Board Management, Canvas controls | Accepted for P0 alpha; regression fixes only |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI, Postgres, R2/S3, migrations, Auth, real Board CRUD, deployment | Next active architecture slice: data/API/Auth/deploy changes |
| S1A DB Schema | `ARCH_slice_S1A_db_schema.md` | Formal schema, Alembic migrations, constraints, indexes, future-compatible join points | Implemented and locally smoke-tested; staging DB smoke pending S1B |
| S1B Staging Infra | `ARCH_slice_S1B_staging_infra.md` | Vercel, FastAPI host, Postgres, R2, domain, email provider, staging smoke | When preparing online resources |
| S1C Auth Context | `ARCH_slice_S1C_auth_request_context.md` | Registration, login, sessions, request context, workspace membership authority | After S1A |
| S1D Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | Permission-checked Board list/load/save/history/member APIs | After S1C |
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk, current canvas reference contract, Konva/Yjs replacement path | Konva v2 formal Board route accepted; page contract and v1 copy tooling first pass; collaboration still pending |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | AI node/provider/model changes |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, credits, subscriptions, analytics, moderation facts | Admin/billing/analytics schema changes |
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
          list / open / save / history / copy / delete / role checks
          |
          +----------------------+----------------------+----------------------+
                                 |                      |                      |
                                 v                      v                      v
                         S2 AI Runtime          S3 Admin/Billing        S4 Collaboration
                         provider calls         users/credits/revenue   presence/roles/live sync
                         AiRun/cost logs        analytics/moderation    conflict/history rules
```

Dependency rules:

- S1A is implemented locally; validate it against real Postgres during S1B.
- S1B needs staging Postgres/R2/domain/API resources.
- S1C depends on S1A and an email/session strategy.
- S1D depends on S1A/S1C and becomes the permission foundation for S2/S3/S4.
- S2 should use real `user_id`, `workspace_id`, `board_id` from S1 before charging credits or writing provider logs.
- S3 can prepare schemas early, but real Admin/Credits/Billing needs S1 identity and S2 cost facts.
- S1X currently provides the Konva-first Board runtime; it still needs collaboration/Yjs proof before S4.
- S4 must wait for S1 permissions and stable Board/Asset/History contracts.

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
