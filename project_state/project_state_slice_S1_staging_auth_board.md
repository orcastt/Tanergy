# Project State Slice S1: Staging, Auth And Board

**Updated**: 2026-05-05
**Status**: Recommended next launch/backend slice after S1X Page polish hand-test and commit.

## Purpose

S1 moves TANGENT from local/dev identity to real users, real workspaces and server-side Board ownership. It should make the current local Board product usable on staging without users seeing or mutating each other's data.

## Needed External Resources

- Staging API server or VPS.
- Managed Postgres or staging Postgres instance.
- R2/S3-compatible bucket and credentials.
- Staging domain and TLS.
- Email provider and sender-domain setup.
- Auth provider setup for Google OAuth, likely Clerk first.
- Google Cloud OAuth production client setup before public launch.
- Konva-first Board route deployed with tldraw reference disabled by default.

## First Checks When Resources Exist

1. FastAPI `/health` on public staging.
2. CORS from staging Web origin.
3. Asset upload/read.
4. Board save/load/history create/list/load.
5. Guard rejects `data:` / `blob:`.
6. Web app uses `NEXT_PUBLIC_API_BASE_URL`.
7. `/boards/[boardId]` opens Konva v2 in production-like env without tldraw license dependency.

## Local Work That Can Start Before Resources

1. Run S1A Alembic migration smoke against empty and P0-seeded staging Postgres when S1B resources exist.
2. Define Auth API contracts for register/login/logout/session refresh and Google OAuth/JWT verification.
3. Define request-context rules: client user/workspace ids are hints only; server session is authority.
4. Define Board permission matrix for owner/admin/editor/viewer.
5. Add tests for cross-user isolation once API endpoints are wired.
6. Keep `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` as the cross-slice handoff checklist.

## S1 Sub-Slices

| Sub-slice | Status | Output |
| --- | --- | --- |
| S1A DB schema + migrations | `project_state_slice_S1A_db_schema.md` | Implemented and locally smoke-tested; staging DB smoke pending S1B | Formal Alembic migrations and schema contracts for identity, workspace, Board, History and Asset facts. |
| S1B Staging infra smoke | `project_state_slice_S1B_staging_infra.md` | Waiting on resources | Public FastAPI health, CORS, staging Postgres, R2/S3 and Web API base URL smoke. |
| S1C Auth/request context | `project_state_slice_S1C_auth_request_context.md` | After S1A | Register/login/logout/session and default workspace creation. |
| S1D Auth-backed Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | After S1C | Server-scoped Board list/load/save/history/copy/delete and owner/admin/editor/viewer checks. |

S2/S3/S4 should not consume mock identity once S1 starts. They can keep planning, but implementation should use the S1 user/workspace/board contracts.

Current launch note: S1X has mitigated the tldraw production blocker locally by making Konva v2 the production Board default and gating tldraw reference usage. Do not ship new tldraw-only product behavior while S1 moves to staging/Auth/Board ownership.

## Not Started

- Real Auth.
- Real workspace membership API behavior.
- Real Board member/share permissions.
- Server-side pagination under real DB scale.
- Credit ledger/team billing enforcement.
- Full Admin dashboard.
- Real-time collaboration.
