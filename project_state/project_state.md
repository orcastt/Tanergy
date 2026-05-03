# TANGENT Project State Index

**Updated**: 2026-05-03
**Branch**: `feature/s1x-konva-handfeel-spike`
**Latest local checkpoint**: latest commit on the active branch; keep detailed history in Git.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

Public staging is now live enough to expose a production tldraw license requirement. S1X is the active risk-mitigation spike: keep current tldraw as the reference implementation, but evaluate Konva + Yjs before adding more tldraw-only product work.

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
  S1A DB schema/migrations
  Auth scaffold
  AI contract scaffold
  Alembic scaffold
  Admin S0 planning

Not production-complete:
  real Auth/email/session
  real team/share permissions
  staging auth/email/license hardening
  long-term non-tldraw canvas engine
  real AI provider/cost logs
  full Admin/Billing/Analytics
  collaboration
```

## State Slice Index

| Slice | File | Status |
| --- | --- | --- |
| S0 Local Polish | `project_state_slice_S0_local_polish.md` | Accepted for P0 alpha; checkpoint/regression only |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | Recommended next architecture slice |
| S1A DB Schema | `project_state_slice_S1A_db_schema.md` | Implemented and locally smoke-tested; staging DB smoke pending S1B |
| S1B Staging Infra | `project_state_slice_S1B_staging_infra.md` | In progress; FastAPI/Neon/R2 smoke passed |
| S1C Auth Context | `project_state_slice_S1C_auth_request_context.md` | After S1A |
| S1D Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | After S1C |
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Phase 3 object editing foundation in progress; box select, resize and undo/redo first pass |
| S2 AI/Admin Future | `project_state_slice_S2_ai_admin_future.md` | Planned |

## Current Next Fork

If external resources are not ready:

1. Final S0 browser smoke and checkpoint commit.
2. i18n/status polish and visible loading/error/copy feedback.
3. More realistic empty/error states for mocked production surfaces.
4. Prepare S1 Auth API contracts locally.

If external resources are ready:

1. Finish recording S1B staging smoke status.
2. Continue S1X Phase 3 object editing foundation at `/spikes/konva-canvas`.
3. Add selection, resize, command history and clipboard before node/image migration.
4. Continue S1C Auth if the canvas engine decision is accepted.

## Next Slice Order

```text
Now: checkpoint S0 accepted state
  |
  v
S1A local schema/contracts (implemented; real DB smoke pending)
  users, workspaces, members, boards, snapshots, assets, auth_sessions
  |
  v
S1B staging smoke
  Postgres, R2, FastAPI health, domain, CORS, Web API base URL
  |
  v
S1X canvas engine migration spike
  tldraw reference contract, Konva handfeel, Yjs viability
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

Current recommendation: pause deeper tldraw work and run S1X handfeel/collaboration spike before S1C Auth deepens canvas product coupling. S1A is implemented and S1B staging Web/API/Postgres/R2 smoke is mostly through, with tldraw license as the newly exposed frontend blocker.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.
