# ARCH Slice S1: Persistence, Auth And Deploy

**Updated**: 2026-05-06
**Mode**: Architecture slice.

## Scope

Real staging infrastructure, persistent data, real Auth/session, and Auth-backed Board CRUD. S1 turns the local product shell into a multi-user staging product with server-side ownership and permission checks.

## P0 Alpha Boundary

In the current release pass, this slice exists to make the core user journey safe and real:

- landing/Auth/workspace route safety
- Board/share/page permission safety
- staging persistence and object-storage integrity

It must not absorb collaboration, finance or deep admin scope.

## Target Architecture

```text
Next Web
  -> Auth Provider UI/JWT: Clerk preferred, Supabase Auth acceptable
  -> NEXT_PUBLIC_API_BASE_URL
  -> FastAPI /api/v1
      -> request context from verified session/JWT
      -> Postgres storage adapters
      -> R2/S3-compatible object storage
```

## What S1 Builds

```text
User registers/logs in
  -> email OTP/magic link or Google OAuth
  -> provider/server session/JWT
  -> user row
  -> default workspace
  -> workspace membership
  -> server-scoped Board list
  -> server-scoped Board load/save/history/assets
```

S1 is the identity and ownership foundation. It should not implement every future business system, but its schema must leave clean joins for Admin, Billing, Credits, AI runs and Collaboration.

## Current State

- Next local bridge exists.
- FastAPI local-dev exists.
- Postgres Board/Asset/History adapters exist.
- S3-compatible Asset adapter exists.
- Alembic P0 migration scaffold exists.
- S1A formal schema migrations are implemented locally through revision `20260502_0006` and passed disposable Docker Postgres smoke.
- Staging server, managed Postgres, R2 bucket, domain and TLS have first smoke coverage; email/Auth/OAuth and Konva redeploy smoke still need final staging verification.
- Clerk frontend/session bridge and FastAPI bearer verification first pass are in place; hardening remains.
- S1X now provides a Konva-first Board route and production tldraw reference gate locally; staging must redeploy/smoke that path before public use.

## Core Tables

```text
users
workspaces
workspace_members
boards
board_members
board_snapshots
assets
auth_sessions / email_otps / oauth_accounts
```

## Implemented Persistence Fields

`boards` / current `tangent_boards` adapter:

```text
id
workspace_id
owner_id
title
document JSONB
byte_size
asset_count
shape_count
description
card_color
thumbnail_url
last_opened_at
created_at
is_starred
is_pinned
visibility
share_id
saved_at
```

`assets` / current `tangent_assets` adapter:

```text
id
workspace_id
created_by
title
origin
mime
byte_size
width
height
storage
original_url
thumbnail_256_url
thumbnail_512_url
thumbnail_1024_url
created_at
```

`board_snapshots` / current `tangent_board_snapshots` adapter:

```text
id
workspace_id
board_id
created_by
title
document JSONB
document_hash
byte_size
asset_count
shape_count
thumbnail_url
reason
retention_tier
expires_at
created_at
```

Future product tables:

```text
users
workspaces
workspace_members
board_members
auth_sessions
email_otps
oauth_accounts
```

S1-compatible future tables, planned but not fully productized in this slice:

```text
admin_roles
admin_audit_logs
credit_accounts
credit_ledger
subscriptions
ai_runs
ai_api_calls
analytics_events
```

## S1 Boundaries

Included:

- Formal Alembic migrations for users, workspaces, memberships, boards, assets and board snapshots.
- Real registration/login/logout/session boundary.
- Per-user default workspace creation.
- Server-side Board CRUD scoped by `user_id`, `workspace_id` and membership role.
- Server-side board/member role model needed by future sharing and collaboration.
- Staging Postgres/R2/domain/CORS smoke.
- Google OAuth through Auth provider, with FastAPI JWT verification and local user mapping.
- Konva-first Board route on staging, with tldraw disabled unless explicitly enabled for reference testing.

Deferred:

- Real-time multiplayer collaboration. S1 only prepares `board_members`; live presence/CRDT belongs to S4.
- Full Admin dashboard. S1 may create `admin_roles` compatibility, but production `/admin` belongs to S3.
- Credit deduction and subscription enforcement. S1 may prepare user/account ids; credit ledger and team billing rules belong to S3 after Auth is real.
- Real AI provider cost routing. AiRun/provider cost logs belong to S2.

## S1 Sub-Slices

| Sub-slice | File | Status | Output |
| --- | --- | --- | --- |
| S1A DB schema + migrations | `ARCH_slice_S1A_db_schema.md` | S1A core done through `0006`; current head includes S3 `0007` | Formal schema, constraints, indexes and future-compatible join points. |
| S1B staging infra smoke | `ARCH_slice_S1B_staging_infra.md` | Web/API/Neon/R2 smoke passed; Auth/email/OAuth/Konva redeploy pending | Public Web/API, Postgres, R2, DNS/TLS and email provider smoke. |
| S1C Auth/request context | `ARCH_slice_S1C_auth_request_context.md` | Clerk/FastAPI bearer first pass landed; hardening pending | Real sessions, default workspace and server-side request context. |
| S1D Auth-backed Board CRUD | `ARCH_slice_S1D_auth_board_crud.md` | First-pass CRUD/member/share/public-share stable | Board/History/Asset APIs scoped by user, workspace and role. |

## API Rules

- Board list returns summaries only.
- Board load returns full document only after permission check.
- Board save/history writes must scope by user/workspace.
- Upload/read must enforce MIME, size and storage key rules.
- No client-provided user/workspace id is authority once real Auth exists.

## Validation Target

- Fresh user can register, verify/login, and land in `/workspaces`.
- Fresh user can sign up/login with Google OAuth and land in `/workspaces`.
- User receives one default workspace and owner membership.
- Board create/open/rename/copy/delete/list/save/history works through FastAPI with staging Postgres/R2.
- User A cannot list, load, save, delete or view History for User B's Board.
- Editor/viewer role checks are enforced server-side for Board mutation.
- `data:` / `blob:` documents still fail guard validation.

## Deployment Gates

1. `/health` on public staging API.
2. CORS allows staging Web origin only.
3. PNG/JPEG/WebP upload/read works.
4. Board save/load/history works against staging Postgres.
5. Guard rejects `data:` / `blob:` documents.
6. Rollback path documented.
7. `/boards/[boardId]` opens Konva v2 in production-like staging without tldraw license dependency.
