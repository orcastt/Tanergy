# Project State Slice S1: Staging, Auth And Board

**Updated**: 2026-05-18
**Status**: Active umbrella. Use S1A/S1B/S1C/S1D/S1X slice files for detailed truth; this file summarizes the current launch boundary where staging Web/API/Supabase Pro/R2 plus real session/admin smoke are green. The first signed-in board/browser pass is green and the second-round pass is mostly green; R2 clean asset smoke, re-created staging data, the `Manage board -> Copy board` Free-plan limit modal edge, Google/email verification and one live AI smoke remain.

## Purpose

S1 moves TANGENT from local/dev identity to real users, real workspaces and server-side Board ownership. It should make the current local Board product usable on staging without users seeing or mutating each other's data.

## Current Alpha Boundary

In the current pass, this slice is only trying to make the main user journey safe enough to test:

- landing/Auth/workspace entry
- Board/page/share permission boundaries
- staging persistence and asset loading

Group/Team business depth, real payments and collaboration remain outside this slice's current promise.

## Needed External Resources

- Staging API server or VPS.
- Managed Postgres or staging Postgres instance.
- R2/S3-compatible bucket and credentials.
- Staging domain and TLS.
- Email provider and sender-domain setup.
- Auth provider setup for Google OAuth, likely Clerk first.
- Google Cloud OAuth production client setup before public launch.
- Konva-only Board route deployed, with legacy Board documents blocked in the active app path.

## First Checks When Resources Exist

1. FastAPI `/health` on public staging.
2. CORS from staging Web origin.
3. Asset upload/read.
4. Board save/load/history create/list/load.
5. Guard rejects `data:` / `blob:`.
6. Web app uses `NEXT_PUBLIC_API_BASE_URL`.
7. `/boards/[boardId]` opens Konva v2 in production-like env without any legacy paid-canvas dependency.

## Local Work That Can Start Before Resources

1. Run S1A Alembic migration smoke against empty and P0-seeded staging Postgres when S1B resources exist.
2. Define Auth API contracts for register/login/logout/session refresh and Google OAuth/JWT verification.
3. Define request-context rules: client user/workspace ids are hints only; server session is authority.
4. Define Board permission matrix for owner/admin/editor/viewer.
5. Add tests for cross-user isolation once API endpoints are wired.
6. Use `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md` as the current cross-slice handoff checklist, and use `dev-plans/s1b-supabase-r2-redis-collaboration-infra-plan-2026-05-18.md` for the database/R2/realtime infrastructure checklist. The old launch-readiness report is archived.

## S1 Sub-Slices

| Sub-slice | Status | Output |
| --- | --- | --- |
| S1A DB schema + migrations | `project_state_slice_S1A_db_schema.md` | Implemented and locally smoke-tested; fresh Supabase Pro Alembic-to-head smoke passed | Formal Alembic migrations and schema contracts for identity, workspace, Board, History and Asset facts. |
| S1B Staging infra smoke | `project_state_slice_S1B_staging_infra.md` | Web/API/Supabase Pro/R2, Konva redeploy, real session/admin smoke and final-snapshot realtime persistence green; R2 clean asset, Google/email/live-AI pending | Public FastAPI health, CORS, staging Postgres, R2/S3 and Web API base URL smoke. |
| S1C Auth/request context | `project_state_slice_S1C_auth_request_context.md` | Clerk/FastAPI bearer first pass plus real session/admin smoke landed; hardening pending | Register/login/logout/session and default workspace creation. |
| S1D Auth-backed Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | First-pass CRUD/member/share/public-share stable | Server-scoped Board list/load/save/history/copy/delete and owner/admin/editor/viewer checks. |

S2/S3/S4 should not consume mock identity once S1 starts. They can keep planning, but implementation should use the S1 user/workspace/board contracts.

Current launch note: S1X has closed the old paid-canvas blocker locally by making Konva v2 the only active Board runtime and blocking legacy v1 Board docs/history from the active app path. Do not reintroduce legacy canvas compatibility behavior while S1 moves to staging/Auth/Board ownership.

## Still Not Production-Complete

- Auth email/logout/session revocation and full staging Google OAuth/JWT smoke.
- Full workspace membership matrix and multi-workspace selection.
- Final `Can view / Can edit / Can manage / Owner` effective permission resolver.
- Invite-accept/editor-management hardening beyond the current first pass.
- Credit ledger/team billing enforcement.
- Full Admin/Billing/Analytics.
- Real-time collaboration.
