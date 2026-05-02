# Project State Slice S1: Staging, Auth And Board

**Updated**: 2026-05-02
**Status**: Recommended next architecture slice.

## Purpose

S1 moves TANGENT from local/dev identity to real users, real workspaces and server-side Board ownership. It should make the current local Board product usable on staging without users seeing or mutating each other's data.

## Needed External Resources

- Staging API server or VPS.
- Managed Postgres or staging Postgres instance.
- R2/S3-compatible bucket and credentials.
- Staging domain and TLS.
- Email provider and sender-domain setup.
- tldraw production license before production deploy.

## First Checks When Resources Exist

1. FastAPI `/health` on public staging.
2. CORS from staging Web origin.
3. Asset upload/read.
4. Board save/load/history create/list/load.
5. Guard rejects `data:` / `blob:`.
6. Web app uses `NEXT_PUBLIC_API_BASE_URL`.

## Local Work That Can Start Before Resources

1. Finalize Alembic schema for `users`, `workspaces`, `workspace_members`, `board_members`, `boards`, `board_snapshots`, `assets`, `auth_sessions`, `email_otps` and `oauth_accounts`.
2. Define Auth API contracts for register/login/logout/session refresh.
3. Define request-context rules: client user/workspace ids are hints only; server session is authority.
4. Define Board permission matrix for owner/admin/editor/viewer.
5. Add tests for cross-user isolation once API endpoints are wired.

## S1 Sub-Slices

| Sub-slice | Status | Output |
| --- | --- | --- |
| S1A DB schema + migrations | Next | Formal Alembic migrations and schema contracts for identity, workspace, Board, History and Asset facts. |
| S1B Staging infra smoke | Waiting on resources | Public FastAPI health, CORS, staging Postgres, R2/S3 and Web API base URL smoke. |
| S1C Auth/request context | After S1A | Register/login/logout/session and default workspace creation. |
| S1D Auth-backed Board CRUD | After S1C | Server-scoped Board list/load/save/history/copy/delete and owner/admin/editor/viewer checks. |

S2/S3/S4 should not consume mock identity once S1 starts. They can keep planning, but implementation should use the S1 user/workspace/board contracts.

## Not Started

- Real Auth.
- Real workspace membership.
- Real Board member/share permissions.
- Server-side pagination under real DB scale.
- Credit ledger/team billing enforcement.
- Full Admin dashboard.
- Real-time collaboration.
