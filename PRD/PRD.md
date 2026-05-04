# TANGENT Product Requirements Index

**Updated**: 2026-05-03
**Status**: Canonical product overview and PRD slice index.

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
| S1 Staging/Auth/Board CRUD | `PRD_slice_S1_staging_auth_board.md` | Real staging infra, real Auth, real user/workspace/board ownership, production Board CRUD | Recommended next architecture slice |
| S1A DB Schema | `PRD_slice_S1A_db_schema.md` | Product data model for accounts, workspaces, Boards, History, Assets and future billing/AI/admin joins | Implemented and locally smoke-tested; staging DB smoke pending S1B |
| S1B Staging Infra | `PRD_slice_S1B_staging_infra.md` | Online staging Web/API, Postgres, R2, DNS and email readiness | Waiting on resources |
| S1C Auth Context | `PRD_slice_S1C_auth_request_context.md` | Registration, login, logout, session and default workspace flow | After S1A |
| S1D Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Auth-backed Board and History user workflows | After S1C |
| S1X Canvas Engine Migration | `PRD_slice_S1X_canvas_engine_migration.md` | Production license risk, tldraw reference parity, Konva/Yjs handfeel and collaboration viability | Phase 3A image paste/LOD first pass added |
| S2 AI Productization | `PRD_slice_S2_ai_productization.md` | Real AI provider path, Model Registry, AiRun, cost/credit logs, AI Chat planner | Contract scaffold only |
| S3 Admin/Billing/Analytics | `PRD_slice_S3_admin_billing_analytics.md` | Admin access, user management, credits, subscriptions, analytics, moderation | Schema/access boundary only |
| S4 Collaboration | `PRD_slice_S4_collaboration.md` | Multi-user Board collaboration, presence, roles, conflict boundaries | Deferred to P0.5 |

## Update Rules

- During active development, update only the relevant `PRD_slice_*.md`.
- When a slice reaches a stable checkpoint, update the status table above.
- Do not duplicate detailed acceptance lists in this index.
- Product requirements go here; implementation details go to `../ARCH/`.
- Current progress, commits and handoff notes go to `../project_state/`.

## Current Product Priority

If external resources are not ready:

1. Final S0 browser smoke and checkpoint commit.
2. i18n and visible status polish.
3. More realistic empty/error states for mocked production surfaces.
4. Prepare S1 Auth API contracts locally.

If external resources are ready:

1. Staging Postgres/R2/domain smoke.
2. S1X canvas engine handfeel/collaboration spike.
3. Real Auth and workspace ownership.
4. Auth-backed Board CRUD.
5. Real AI provider path.

## Product Stage Roadmap

```text
S0 Local Alpha accepted
  - local workspace/board shell
  - Board save/history/thumbnails
  - Canvas Settings and Smart Drawing

S1 Account + Ownership foundation
  - S1X canvas engine migration spike if production license risk is unresolved
  - register/login/logout/session
  - user default workspace
  - server-scoped Board CRUD and History
  - owner/admin/editor/viewer permission checks

S2 AI Productization
  - real provider routes
  - Model Registry and AiRun persistence
  - per-user AI usage history and cost facts

S3 Admin + Billing + Analytics
  - admin roles and audit logs
  - user management
  - credits, subscriptions, team billing pools
  - revenue/usage/retention analytics

S4 Collaboration
  - live presence
  - multi-user Board editing
  - member roles and conflict/history behavior
```

S1 deliberately does not finish Admin, credits, subscriptions or collaboration. It creates the user/workspace/board ownership facts those stages need.
