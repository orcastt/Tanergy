# PRD Slice S1: Staging, Auth And Board CRUD

**Updated**: 2026-05-02
**Mode**: Architecture slice.

## Goal

Move from local dev identity and local persistence to real staging infrastructure, real users, real workspaces and Auth-backed Board CRUD. This is the step where TANGENT stops being a single local canvas and starts behaving like a real multi-user web product.

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

## Included In S1

- Database migrations for users, workspaces, workspace members, board members, boards, board history and assets.
- Registration/login/logout/session using email OTP or magic link.
- Default workspace creation for every new user.
- User-scoped Board list/open/save/history/rename/delete/copy.
- Owner/admin/editor/viewer permission checks on server APIs.
- Staging Postgres/R2/domain/CORS smoke.

## Prepared But Not Fully Built In S1

- Admin roles and audit logs: schema compatibility may be added, but the full Admin dashboard is S3.
- Credits and subscriptions: ids and ownership must be compatible, but real credit deduction, team billing pools and invoices are S3.
- AI usage/cost logs: S1 must not block them, but real provider cost tracking is S2.
- Collaboration: S1 creates the membership truth needed later, but live multiplayer/presence is S4.

## Acceptance

- New user can register and verify email.
- Login redirects to `/workspaces`.
- Board list returns summaries only, not full documents.
- Board load returns full document only for authorized users.
- Board save, History create/list/load and thumbnail metadata work against staging Postgres/R2.
- User A cannot read or mutate User B's Board.
- Owner/admin can mutate Board metadata; viewer cannot.
- Board History remains scoped to authorized members only.

## Non-Goals

- No AI provider integration in this slice.
- No full Admin analytics.
- No real-time collaboration.
