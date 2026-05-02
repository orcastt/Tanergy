# ARCH Slice S1A: Database Schema And Migration

**Updated**: 2026-05-02
**Mode**: Architecture slice.
**Status**: Implemented and locally smoke-tested; staging DB smoke pending S1B resources.

## Goal

Turn the P0 scaffold tables into a formal production-ready schema foundation. S1A must make identity, workspace ownership, Board permissions, Board History, Assets, AI usage, Admin audit, Credits and future Collaboration joinable without forcing those later systems to ship now.

## Current Baseline

Existing P0 migrations already create scaffold tables for users, workspaces, workspace memberships, auth sessions, boards, assets, board snapshots, model options, AI runs and API call logs.

Missing production hardening:

- Foreign keys and delete behavior.
- Check constraints for roles, visibility, snapshot reasons, statuses and storage types.
- `board_members`, `board_user_preferences`, `board_assets`, `oauth_accounts`.
- Cursor pagination indexes and search indexes.
- Idempotency and webhook tables for future billing and provider callbacks.
- Ledger-style credit/account schema.
- Admin audit schema.

## Entity Relationship Map

```text
users 1--N workspace_members N--1 workspaces
users 1--N auth_sessions
users 1--N oauth_accounts
users 1--N email_otps

workspaces 1--N boards
workspaces 1--N assets
workspaces 1--N credit_accounts

boards 1--N board_snapshots
boards 1--N board_members N--1 users
boards 1--N board_user_preferences N--1 users
boards N--N assets through board_assets

users/workspaces 1--N ai_runs 1--N ai_api_calls
ai_runs N--N assets through ai_run_assets

users/workspaces 1--N credit_ledger
users/admins 1--N admin_audit_logs
```

## Required S1A Tables

Identity and Auth:

```text
tangent_users
tangent_user_identities
tangent_auth_sessions
tangent_email_otps
tangent_oauth_accounts
```

Workspace and Board ownership:

```text
tangent_workspaces
tangent_workspace_members
tangent_workspace_invitations
tangent_boards
tangent_board_members
tangent_board_share_links
tangent_board_user_preferences
```

Board persistence and assets:

```text
tangent_board_snapshots
tangent_assets
tangent_asset_variants
tangent_board_assets
tangent_collections
tangent_collection_boards
```

Future-compatible but not fully productized in S1:

```text
tangent_admin_roles
tangent_admin_audit_logs
tangent_admin_user_notes
tangent_credit_accounts
tangent_credit_ledger
tangent_subscriptions
tangent_payments
tangent_invoices
tangent_webhook_events
tangent_model_options
tangent_model_provider_routes
tangent_ai_runs
tangent_ai_api_calls
tangent_ai_run_assets
tangent_api_cost_ledger
tangent_analytics_events
tangent_moderation_items
tangent_idempotency_keys
```

## Implemented Migration Map

```text
20260502_0004_s1a_core_schema
  - users/workspaces scaffold hardening columns
  - workspace_members, user_identities, oauth_accounts
  - workspace_invitations
  - board_members, board_share_links, board_user_preferences
  - asset_variants, board_assets
  - collections, collection_boards

20260502_0005_s1a_future_systems_schema
  - admin_roles, admin_audit_logs, admin_user_notes
  - credit_accounts, credit_ledger
  - subscriptions, payments, invoices, webhook_events
  - model_provider_routes
  - ai_api_calls, ai_run_assets, api_cost_ledger
  - analytics_events, moderation_items, idempotency_keys

20260502_0006_s1a_constraints_indexes
  - FK/check constraints on P0 scaffold tables and S1A tables
  - cursor/list indexes for auth, board history, AI, admin, billing and webhooks

migrations/env.py
  - normalizes postgresql:// to postgresql+psycopg:// for SQLAlchemy/Alembic
```

Fixtures and tests:

```text
services/api/migrations/fixtures/s1a_two_users_two_workspaces.sql
services/api/scripts/s1a_migration_smoke.py
services/api/tests/test_migration_contracts.py
```

## Important Modeling Decisions

- `board_members` is the Board permission authority. Workspace role can grant default access, but Board sharing must be representable independently.
- `is_pinned`, `is_starred` and `last_opened_at` should move to `board_user_preferences`, because these are per-user preferences.
- Team credit pools should be modeled through `credit_accounts.owner_type = workspace`; personal plans can use `owner_type = user`.
- Credit balance must be derived from `credit_ledger`, not stored only as a mutable number on `users`.
- AI usage must split user-visible `ai_runs` from provider-level `ai_api_calls`.
- The existing `tangent_model_options` table remains the current model registry scaffold; S2 should either formalize it in place or migrate it to a dedicated `tangent_model_registry`.
- Board/History documents must store Asset ids/URLs only, never `data:`, `blob:` or Base64 image payloads.

## Indexing Rules

Core list and permission indexes:

```text
users(email)
auth_sessions(token_hash)
workspace_members(user_id, workspace_id)
boards(workspace_id, saved_at DESC, id)
board_members(board_id, user_id)
board_user_preferences(user_id, workspace_id, last_opened_at DESC)
board_snapshots(workspace_id, board_id, created_at DESC, id)
assets(workspace_id, created_by, created_at DESC, id)
ai_runs(workspace_id, created_by, created_at DESC, id)
ai_api_calls(workspace_id, created_at DESC, id)
analytics_events(workspace_id, event_name, created_at DESC)
credit_ledger(account_id, created_at DESC, id)
```

Search:

- Use lower-cased normalized columns for email/title search in S1.
- Add Postgres full-text or trigram search later if Workspace/Board lists become large.

## Migration Rules

- Use Alembic versioned migrations.
- Alembic must use the project `psycopg` v3 driver; `postgresql://` URLs are normalized to `postgresql+psycopg://`.
- Avoid destructive migration for existing local data unless explicitly archived.
- Prefer additive `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, backfill, then constraint.
- Add FK constraints after existing scaffold rows are compatible.
- Add check constraints for enum-like text values.
- All new mutations should be idempotent where external callbacks are involved.

## Smoke Runner

`services/api/scripts/s1a_migration_smoke.py` is a guarded local/staging migration smoke runner. It requires a disposable Postgres URL and `S1A_SMOKE_ALLOW_RESET=1`, because it drops `tangent_%` tables and `alembic_version`.

It validates:

```text
empty database -> alembic head
P0 scaffold seed -> alembic head
required S1A tables/constraints
P0 owner/member preference backfill
```

## Acceptance

- Empty database can run all migrations from scratch. Passed against disposable Docker Postgres; staging Neon/Postgres smoke pending S1B.
- Existing local/staging P0 tables can migrate forward without data loss. P0-seeded Docker Postgres smoke passed; staging Neon/Postgres smoke pending S1B.
- Schema contains formal user/workspace/board permission facts.
- Cross-user isolation can be tested using SQL fixtures.
- S2/S3/S4 can reference stable `user_id`, `workspace_id`, `board_id`, `asset_id`, `ai_run_id`.
