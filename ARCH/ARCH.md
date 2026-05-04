# TANGENT Architecture Index

**Updated**: 2026-05-03
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
  |     |-- tldraw current reference implementation
  |     |-- Konva/Yjs migration spike for long-term engine
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
  src/components/canvas   tldraw shell, toolbar, settings, save/history UI
  src/components/workspaces
  src/features/boards     Board document, metadata, History, client contracts
  src/features/assets     Asset upload, thumbnails, runtime migration
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
| Canvas controls [96%] | Canvas Engine S1X [28%] |
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
| S1X Canvas Engine Migration | `ARCH_slice_S1X_canvas_engine_migration.md` | tldraw license risk, current canvas reference contract, Konva/Yjs replacement path | Phase 3A image paste/LOD first pass added |
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
  |       preserve tldraw behavior as reference, test Konva handfeel, prove Yjs path
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
- S4 must wait for S1 permissions and stable Board/Asset/History contracts.

## Non-Negotiable Boundaries

- Board documents, Board History documents, node props and future collaboration docs must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text.
- Image binaries and thumbnails belong in object storage; documents store URLs/Asset ids only.
- AI provider calls are server-side only and flow through Model Registry + AiRun contracts.
- Admin permissions are server-side through `admin_roles`; frontend role flags are not authority.
- Real collaboration waits until Asset, Board, Auth and AiRun boundaries are stable.
- Source files target under 300 lines; split before adding more behavior to already large files.

## Update Rules

- During active development, update the relevant `ARCH_slice_*.md`.
- Update this index only when a slice status, lane, core boundary or file architecture changes.
- Root `ARCH.md` is a pointer only.
- Do not maintain mirror files like `00-current-map.md`; this file is the map.
