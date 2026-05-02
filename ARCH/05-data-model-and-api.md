# Data Model And API Contract Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 5 and 8

This file is the compact cross-system schema/API map. Use it before database, migration, API, Auth, Admin, AI, billing or analytics changes.

## Relationship Overview

```text
User 1 ---- * WorkspaceMembership * ---- 1 Workspace
Workspace 1 ---- * Board
Workspace 1 ---- * WorkspaceMember
Board 1 ---- * BoardSnapshot
Board 1 ---- * BoardMember
Board 1 ---- * Asset
Board 1 ---- * AiRun
Board 1 ---- * AiChatSession
Board 1 ---- 1 document_state(JSON)
AiRun * ---- * Asset(output)
ModelOption 1 ---- * AiRun
User 1 ---- * CreditLedger
User 1 ---- * AnalyticsEvent
User 1 ---- * AdminUserNote
AdminRole * ---- 1 User
```

P0 may simplify to one personal workspace per user, but schema should not block team/workspace growth.

## Implemented Or Partially Implemented Tables

| Table / concept | Status | Notes |
| --- | --- | --- |
| `tangent_boards` | Implemented | Board document + summary metadata. |
| `tangent_board_snapshots` | Implemented | Product name: Board History. Summary list, explicit document load. |
| `tangent_assets` | Implemented | Postgres metadata for S3-compatible object storage shape. |
| `tangent_users` | Migration scaffold | Runtime still uses mock Auth. |
| `workspaces` / memberships | Migration scaffold / target | Real Auth and membership still pending. |
| `model_options` | Mock contract | Real provider registry pending. |
| `ai_runs` / `api_call_logs` | Mock/schema target | Real provider and cost logs pending. |

## Target Tables Not Yet Production-Complete

```text
users
workspaces
workspace_members
board_members
auth_sessions
email_otps
oauth_accounts

admin_roles
admin_audit_logs
admin_user_notes

credit_accounts
credit_ledger
subscriptions
payments
invoices

model_registry
model_provider_routes
ai_runs
ai_api_calls
api_cost_ledger

analytics_events
analytics_funnel_snapshots
analytics_cohort_snapshots

moderation_items
moderation_actions
```

## Board / History / Asset Rules

- `boards` list/search/pagination returns summary only.
- `boards/{id}` load returns full document after user/workspace check.
- `board_snapshots` list returns summary only.
- `board_snapshots/{id}` load returns document after user/workspace check.
- Board and History documents must pass guard.
- Assets own file bytes and generated/captured image storage.
- Board and History may store Asset URLs/ids, never file bytes.

## API Map

Auth:

```http
GET  /api/v1/auth/session
GET  /api/v1/me
POST /api/v1/auth/login
POST /api/v1/auth/logout
```

Boards:

```http
GET    /api/v1/boards
POST   /api/v1/boards
GET    /api/v1/boards/{board_id}
PATCH  /api/v1/boards/{board_id}
DELETE /api/v1/boards/{board_id}
POST   /api/v1/boards/validate-document
POST   /api/v1/boards/{board_id}/snapshots
GET    /api/v1/boards/{board_id}/snapshots
GET    /api/v1/boards/{board_id}/snapshots/{snapshot_id}
```

Assets:

```http
POST /api/v1/assets/upload
POST /api/v1/assets/from-data-url
GET  /api/v1/assets/{asset_id}
GET  /api/v1/assets/files/{asset_id}/{file_name}
```

AI:

```http
GET  /api/v1/ai/models?capability=image_generation
POST /api/v1/ai/runs
GET  /api/v1/ai/runs/{run_id}
POST /api/v1/ai/planner
```

Next local bridge equivalents live under:

```text
/api/boards/local-*
/api/assets/*
/api/auth/session
/api/ai/models
/api/ai/runs
```

## Migration Rule

- Staging/prod should run Alembic migrations first.
- `TANGENT_POSTGRES_AUTO_CREATE_TABLES=0` should be the default outside debugging.
- Adapter auto-create is local/staging bootstrap help, not a substitute for migrations.

## Permission Rule

All future production API reads/writes must:

1. Resolve trusted user/session server-side.
2. Resolve current workspace.
3. Check Board/Asset/AI/Admin membership or role.
4. Scope SQL/object keys by workspace.
5. Return 403/404 without leaking cross-workspace existence.

Frontend disabled controls are not authorization.
