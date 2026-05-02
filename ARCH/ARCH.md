# TANGENT Architecture Index

**Updated**: 2026-05-02
**Status**: Canonical architecture overview and slice index.

This file replaces the former duplicated `ARCH/00-current-map.md` plus the long root `ARCH.md`. The root `ARCH.md` is now only a pointer.

## System Overview

```text
Browser
  |
  v
Next.js Web App
  |-- Product Shell routes
  |-- tldraw Canvas Runtime
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
Project_state             Current progress and handoff slices
dev-plans                 Active implementation plans and historical archive
```

## Parallel Development Lanes

Percentages mean distance to local/P0 alpha usefulness, not final commercial completeness.

```text
                 +-----------------------------+
                 | Current baseline / S0 polish|
                 | Product shell + Board local |
                 +--------------+--------------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v--------+      +-------v--------+      +-------v--------+
| Local Polish   |      | Real Boundary  |      | AI Runtime     |
| S0             |      | S1             |      | S2             |
+-------+--------+      +-------+--------+      +-------+--------+
        |                       |                       |
| Product shell [90%]   | Staging infra [0%]   | Model Registry [35%]
| Board save UX [90%]   | Auth boundary [35%]  | AiRun/logs [20%]
| Board History [92%]   | Board CRUD API [25%] | Provider route [0%]
| Canvas Settings [92%] | Postgres/R2 [0%]     | AI Chat planner [10%]
| Board Mgmt [86%]      |
| Captured thumb [85%]  |
| Smart Drawing [82%]   |
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
| S0 Local Polish | `ARCH_slice_S0_local_polish.md` | Product shell, Workspace, Board save/history, Canvas Settings, Smart Drawing, Board Management | Local UI/canvas/Board behavior changes |
| S1 Persistence/Auth/Deploy | `ARCH_slice_S1_persistence_auth_deploy.md` | FastAPI, Postgres, R2/S3, migrations, Auth, real Board CRUD, deployment | Data/API/Auth/deploy changes |
| S2 AI Runtime | `ARCH_slice_S2_ai_runtime.md` | Node Registry, Model Registry, AiRun, provider routing, AI Chat planner | AI node/provider/model changes |
| S3 Admin/Billing/Analytics | `ARCH_slice_S3_admin_billing_analytics.md` | Admin roles, audit, credits, subscriptions, analytics, moderation facts | Admin/billing/analytics schema changes |
| S4 Collaboration | `ARCH_slice_S4_collaboration.md` | Multiplayer, presence, CRDT boundaries, roles | Collaboration work begins |

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
