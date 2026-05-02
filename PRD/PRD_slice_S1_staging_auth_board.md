# PRD Slice S1: Staging, Auth And Board CRUD

**Updated**: 2026-05-02
**Mode**: Architecture slice.

## Goal

Move from local dev identity and local persistence to real staging infrastructure, real users, real workspaces and Auth-backed Board CRUD.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Staging Web/API | A public staging Web origin can call a public staging FastAPI origin over HTTPS. | Not started |
| Object storage | Uploaded and captured images persist in R2/S3-compatible storage and reload from URL. | Local/FastAPI adapters exist; real staging pending |
| Database | Board, Asset and History data persist in managed Postgres via migrations. | Alembic scaffold exists; real staging pending |
| Auth | Users can register/login/logout through email OTP or magic link. | Scaffold only |
| Workspace ownership | New users get a workspace; API queries are scoped by user/workspace. | Schema planned |
| Board CRUD | Board list/search/pagination/open/rename/delete/copy is server-side and permission checked. | Local first pass only |
| Share/member permissions | Owner/admin/editor/viewer states become real server-side roles. | UI scaffold only |

## Acceptance

- New user can register and verify email.
- Login redirects to `/workspaces`.
- Board list returns summaries only, not full documents.
- Board load returns full document only for authorized users.
- Board save, History create/list/load and thumbnail metadata work against staging Postgres/R2.
- User A cannot read or mutate User B's Board.

## Non-Goals

- No AI provider integration in this slice.
- No full Admin analytics.
- No real-time collaboration.
