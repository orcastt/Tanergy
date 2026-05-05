# TANGENT Project State Index

**Updated**: 2026-05-05
**Branch**: `feature/s1x-konva-handfeel-spike`
**Latest local checkpoint**: S1X page contract + v1 copy tooling checkpoint; keep detailed history in Git.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

S1X has reached a stable basic migration checkpoint. Konva v2 is now the formal Board runtime for new/missing Boards and saved Konva Boards. tldraw remains available as a development reference route, but production defaults block tldraw Board runtime usage. Collaboration/Yjs proof and real AiRun execution remain future work.

Operationally, this means `/boards/[boardId]` is the Konva-first path to keep polishing, `/spikes/canvas` is only a reference surface, and new canvas requirements should update the S1X slice docs before this total index is touched again.

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
  Konva Canvas Settings route/toolbar integration
  Canvas header/switcher/properties polish accepted
  Smart Drawing accepted for local P0 alpha
  S1X Konva v2 Board save/load/history/thumbnail
  S1X formal /boards/[boardId] dual-engine detector
  tldraw production gate and local old v1 Board cleanup
  S1X Konva v2 page contract first pass
  S1X explicit v1-to-v2 copy tooling first pass
  S1A DB schema/migrations
  Auth scaffold
  AI contract scaffold
  Alembic scaffold
  Admin S0 planning

Not production-complete:
  real Auth/email/session
  real team/share permissions
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  Konva collaboration/Yjs provider sync
  Konva page switching UI and page thumbnails
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
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Konva Board route accepted; page contract and v1 copy tooling first pass; collaboration pending |
| S2 AI/Admin Future | `project_state_slice_S2_ai_admin_future.md` | Planned |

## Current Next Fork

If external resources are not ready:

1. Hand-test S1X page contract save/restore and v1-to-v2 copy tooling on real legacy Boards.
2. Continue S1X Konva Board polish on the formal route.
3. Prepare page switching UI/page thumbnails and real AiRun handoff boundaries.
4. Prepare S1 Auth API contracts locally.

If external resources are ready:

1. Finish recording S1B staging smoke status.
2. Deploy Konva-first Board route to staging with tldraw disabled by default.
3. Continue S1C Auth and S1D Auth-backed Board CRUD on top of the Konva v2 Board contract.
4. Move S2 real AI provider work through server-side AiRun contracts.

## Next Slice Order

```text
Now: S1X Konva-first Board stabilization
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
S1X canvas engine migration
  Konva v2 Board route accepted, tldraw reference gated, Yjs viability pending
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

Current recommendation: keep tldraw as reference-only, finish Konva formal Board polish and document contracts, then proceed with S1C/S1D Auth-backed Board ownership on top of the Konva v2 Board contract. S1A is implemented and S1B staging Web/API/Postgres/R2 smoke is mostly through; the earlier tldraw license blocker is mitigated locally by the production gate and Konva route migration.

Next S1X checkpoint should be one of: page switching UI/page thumbnails, transparent-background/export polish, precise legacy style/binding migration if hand-test finds gaps, or the Phase 6 Yjs collaboration proof. Avoid adding new tldraw-only behavior.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.
