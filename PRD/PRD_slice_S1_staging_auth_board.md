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
| Database | Board, Asset and History data persist in managed Postgres via migrations. | S1A migrations implemented locally; real staging smoke pending |
| Auth | Users can register/login/logout through email OTP, magic link or Google OAuth. | Scaffold only |
| Workspace ownership | New users get a workspace; API queries are scoped by user/workspace. | Schema implemented locally; Auth wiring pending |
| Board CRUD | Board list/search/pagination/open/rename/delete/copy is server-side and permission checked. | Local first pass only |
| Share/member permissions | Owner/admin/editor/viewer states become real server-side roles. | UI scaffold only |

## Included In S1

- Database migrations for users, workspaces, workspace members, board members, boards, board history and assets.
- Registration/login/logout/session using email OTP or magic link.
- Google OAuth signup/login through Auth provider, with local TANGENT user mapping.
- Default workspace creation for every new user.
- User-scoped Board list/open/save/history/rename/delete/copy.
- Owner/admin/editor/viewer permission checks on server APIs.
- Staging Postgres/R2/domain/CORS smoke.

## S1 Sub-Slices

| Sub-slice | File | Product outcome |
| --- | --- | --- |
| S1A DB schema + migrations | `PRD_slice_S1A_db_schema.md` | Account/workspace/Board facts are modeled locally; staging DB smoke still pending. |
| S1B staging infra | `PRD_slice_S1B_staging_infra.md` | The app can be tested online against real staging services. |
| S1C Auth/request context | `PRD_slice_S1C_auth_request_context.md` | Users can register/login and get their own workspace. |
| S1D Auth-backed Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Users can safely save, reopen and manage only authorized Boards. |

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
