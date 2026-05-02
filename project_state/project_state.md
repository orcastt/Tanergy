# TANGENT Project State Index

**Updated**: 2026-05-02
**Branch**: `feature/local-polish-fast-slices`
**Latest local checkpoint**: latest commit on the active branch; keep detailed history in Git.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

```text
Done locally:
  Product Shell
  Workspace Board gallery/list
  Workspace board action menu polish
  Board save/autosave
  Board History long-session regression
  Board Management metadata
  Board Management layout polish
  Captured thumbnails
  Canvas Settings
  Canvas header/switcher/properties polish accepted
  Smart Drawing accepted for local P0 alpha
  Auth scaffold
  AI contract scaffold
  Alembic scaffold
  Admin S0 planning

Not production-complete:
  real Auth/email/session
  real team/share permissions
  real staging Postgres/R2/domain
  real AI provider/cost logs
  full Admin/Billing/Analytics
  collaboration
```

## State Slice Index

| Slice | File | Status |
| --- | --- | --- |
| S0 Local Polish | `project_state_slice_S0_local_polish.md` | Accepted for P0 alpha; checkpoint/regression only |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | Recommended next architecture slice |
| S2 AI/Admin Future | `project_state_slice_S2_ai_admin_future.md` | Planned |

## Current Next Fork

If external resources are not ready:

1. Final S0 browser smoke and checkpoint commit.
2. i18n/status polish and visible loading/error/copy feedback.
3. More realistic empty/error states for mocked production surfaces.
4. Prepare S1 schema/migration and Auth API contracts locally.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Next Slice Order

```text
Now: checkpoint S0 accepted state
  |
  v
S1A local schema/contracts
  users, workspaces, members, boards, snapshots, assets, auth_sessions
  |
  v
S1B staging smoke
  Postgres, R2, FastAPI health, domain, CORS, Web API base URL
  |
  v
S1C real Auth
  register, login, logout, session, default workspace
  |
  v
S1D Auth-backed Board CRUD
  server-side list/load/save/history/copy/delete and role checks
  |
  +--> S2 real AI provider and AiRun/cost facts
  +--> S3 Admin/Credits/Billing/Analytics
  +--> S4 Collaboration
```

Current recommendation: start with S1A after the S0 checkpoint. It is useful even before external resources arrive and prevents Admin, credits, team billing and collaboration from being built on mock identity.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.
