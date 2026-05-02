# ARCH Slice S1: Persistence, Auth And Deploy

**Updated**: 2026-05-02
**Mode**: Architecture slice.

## Scope

Real staging infrastructure, persistent data, real Auth/session, and Auth-backed Board CRUD.

## Target Architecture

```text
Next Web
  -> NEXT_PUBLIC_API_BASE_URL
  -> FastAPI /api/v1
      -> request context from session/JWT
      -> Postgres storage adapters
      -> R2/S3-compatible object storage
```

## Current State

- Next local bridge exists.
- FastAPI local-dev exists.
- Postgres Board/Asset/History adapters exist.
- S3-compatible Asset adapter exists.
- Alembic P0 migration scaffold exists.
- Real staging server, managed Postgres, R2 bucket, domain, TLS and secrets are not connected.
- Auth is still mock/dev scaffold.

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

## API Rules

- Board list returns summaries only.
- Board load returns full document only after permission check.
- Board save/history writes must scope by user/workspace.
- Upload/read must enforce MIME, size and storage key rules.
- No client-provided user/workspace id is authority once real Auth exists.

## Deployment Gates

1. `/health` on public staging API.
2. CORS allows staging Web origin only.
3. PNG/JPEG/WebP upload/read works.
4. Board save/load/history works against staging Postgres.
5. Guard rejects `data:` / `blob:` documents.
6. Rollback path documented.
