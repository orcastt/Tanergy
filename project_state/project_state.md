# TANGENT Project State Index

**Updated**: 2026-05-02
**Branch**: `feature/local-polish-fast-slices`
**Latest local checkpoint before this documentation restructure**: `1a12d86 checkpoint: thumbnail history smoke and arch slice sync`

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT is in S0 local polish after Slice E persistence foundations.

```text
Done locally:
  Product Shell
  Workspace Board gallery/list
  Board save/autosave
  Board History
  Board Management metadata
  Captured thumbnails
  Canvas Settings
  Smart Drawing first pass
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
| S0 Local Polish | `project_state_slice_S0_local_polish.md` | Active |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | Planned |
| S2 AI/Admin Future | `project_state_slice_S2_ai_admin_future.md` | Planned |

## Current Next Fork

If external resources are not ready:

1. Long-session Board autosave / History regression.
2. Smart Drawing threshold tuning.
3. i18n/status polish.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.
