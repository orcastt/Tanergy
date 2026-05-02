# P0 Database Schema Roadmap

**Date**: 2026-05-01
**Branch**: `feature/asset-lod-roadmap`
**Status**: Active local production-readiness slice. Board / Board Snapshot / Asset Postgres adapters exist; this plan formalizes the P0 schema, introduces Alembic migrations without removing local-dev auto-create fallback yet, and records Admin S0 / Analytics / Credits / Board membership fact-source targets for later migrations.

---

## 1. Why This Exists

The current FastAPI persistence layer can already write Board documents and Asset metadata through Postgres. That is enough for local/staging smoke, but production should not depend on storage adapters creating tables opportunistically.

This slice creates the controlled database path needed before real Auth, AI runs, staging Postgres and production deploy:

- A written P0 schema map.
- An Alembic migration scaffold in `services/api`.
- A first migration that mirrors existing Board / Board Snapshot / Asset tables and reserves the next P0 product tables.
- A schema boundary for Admin S0, AI cost, credits, billing, analytics, moderation and Board membership so future dashboards have real fact sources.
- A compatibility rule: local-dev auto-create remains available, while staging/prod should run migrations.

---

## 2. Current Implemented Tables

### `tangent_boards`

Already used by FastAPI when `TANGENT_BOARD_STORAGE_DRIVER=postgres`.

Current production-facing fields:

```text
id
workspace_id
owner_id
title
document JSONB
byte_size
asset_count
shape_count
thumbnail_url
last_opened_at
saved_at
```

Notes:

- `document` must pass the Board document guard before write.
- List/save responses return summary only; load returns the document.
- `last_opened_at` is summary metadata for Workspace recency and can later be replaced or complemented by per-user recents.

### `tangent_assets`

Already used by FastAPI when `TANGENT_ASSET_METADATA_DRIVER=postgres`.

Current production-facing fields:

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

Notes:

- Object bytes live in R2/S3-compatible storage.
- Asset reads remain routed through FastAPI so request context / workspace checks still apply.

### `tangent_board_snapshots`

Used by FastAPI when `TANGENT_BOARD_STORAGE_DRIVER=postgres`.

Current production-facing fields:

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

Notes:

- `document` must pass the Board document guard before write.
- List responses return summary only; load returns the document.
- P0 retention is `free`: keep the latest 100 history entries per Board by default, configurable with `TANGENT_FREE_BOARD_SNAPSHOT_LIMIT`.
- Pro / Enterprise retention policy can later use `retention_tier` and `expires_at`; large-scale production can move snapshot bodies to object storage while keeping metadata in Postgres.

---

## 3. P0 Target Schema Groups

### Identity

```text
tangent_users
tangent_workspaces
tangent_workspace_memberships
tangent_email_otps
tangent_auth_sessions
```

Purpose:

- Real login / signup / email verification.
- Request context resolved from server-owned session/JWT instead of dev headers.
- Workspace membership and role checks.

### Persistence

```text
tangent_boards
tangent_board_snapshots
tangent_assets
```

Purpose:

- Board metadata and guarded document state.
- Board History for autosave, manual Snapshot, Cmd/Ctrl+S and restore recovery.
- Asset metadata while object bytes stay in object storage.
- Summary-only list endpoints.

### AI

```text
tangent_model_options
tangent_ai_runs
tangent_api_call_logs
```

Purpose:

- Server-owned model registry.
- AI run status, latency, cost and output Asset references.
- Provider call audit and abuse/cost investigation.

### Later Product Surfaces

```text
tangent_collections
tangent_collection_items
tangent_credit_ledger
tangent_subscriptions
```

Purpose:

- Collection/library and billing are not P0 blockers.
- Do not fake these tables into product-complete behavior until Auth and AI costs are real.

### Admin S0 / Access Boundary

```text
tangent_admin_roles
tangent_admin_audit_logs
tangent_admin_user_notes
```

Purpose:

- Grant admin/support/analyst/finance/moderator access separately from public user profile fields.
- Make all backend-sensitive admin writes auditable.
- Store internal user notes for support/debugging without exposing them to normal users.

Rules:

- Production `/admin` must resolve session server-side and check `tangent_admin_roles`.
- Missing admin role returns 403 even if the frontend shows an entry by mistake.
- Grant/revoke role, suspend user, credit adjustment, subscription adjustment, moderation action and impersonation must write audit logs.

### Collaboration Membership

```text
tangent_board_members
```

Purpose:

- Separate Board permissions from Workspace permissions before P0.5 collaboration.
- Support `owner` / `editor` / `viewer` / `temporary_viewer`.
- Track `invited_by`, `joined_at`, `expires_at` and `last_seen_at`.

Rules:

- Workspace owner/admin can manage access, but Board-level role remains the authority for Board collaboration.
- Temporary viewers must have an expiration.

### Credits / Billing / Revenue

```text
tangent_credit_accounts
tangent_credit_ledger
tangent_payments
tangent_invoices
```

Purpose:

- Record balance, reservations, AI spend, refunds, admin adjustments and subscription grants.
- Give future Revenue dashboard real sources for MRR / ARR / churn / ARPU / LTV.

Rules:

- Frontend never directly mutates balance.
- AI charge/refund links to `tangent_ai_runs` or provider call records.
- Admin adjustments require an admin actor and audit log.

### AI API Calls / Model Routes

```text
tangent_model_provider_routes
tangent_ai_api_calls
tangent_api_cost_ledger
```

Purpose:

- Record provider route, model, capability, fallback, timeout, raw cost estimate and enabled state.
- Record each provider call under a user-visible `tangent_ai_runs` row.
- Support backend model route management and cost dashboards without creating a second provider truth source.

Rules:

- Model route management extends Model Registry / AiRun; node UI never hardcodes final provider truth.
- Provider secrets and raw sensitive payloads do not enter admin UI.

### Analytics / Moderation

```text
tangent_analytics_events
tangent_analytics_funnel_snapshots
tangent_analytics_cohort_snapshots
tangent_moderation_items
tangent_moderation_actions
```

Purpose:

- Record screen views, button clicks, feature use, first Board, first AI run, payment and retention events.
- Cache funnel / cohort snapshots for dashboards later.
- Track flagged assets, boards, prompts and user reports plus admin review actions.

Rules:

- Dashboards must use server-side events, ledgers or aggregated snapshots, not guessed UI state.
- Moderation is a later product surface; this roadmap only fixes the storage shape.

Migration note:

- The first migration `20260501_0001` creates P0 core tables and does not yet create every Admin S0 / Analytics / Billing target table.
- When Admin S0 is selected as an implementation slice, add a new Alembic revision instead of mutating the already-created baseline.

---

## 4. Migration Policy

Local development:

- `TANGENT_POSTGRES_AUTO_CREATE_TABLES=1` may stay enabled.
- Storage adapters can auto-create Board / Asset tables for smoke tests.

Staging / production:

- Set `TANGENT_POSTGRES_AUTO_CREATE_TABLES=0`.
- Run Alembic migrations before enabling API traffic.
- Do not hand-edit production tables.

Command shape:

```bash
cd services/api
DATABASE_URL=postgresql://... alembic upgrade head
```

Rollback shape:

```bash
cd services/api
DATABASE_URL=postgresql://... alembic downgrade -1
```

---

## 5. Acceptance

- Alembic scaffold exists and can be imported/compiled.
- First migration creates P0 core tables without needing application startup.
- Existing FastAPI Board / Asset tests still pass.
- Existing local-dev API behavior remains unchanged when Alembic has not been run.
- Workspace Board list can use `lastOpenedAt` for recency without returning full Board documents.
- Board history create/list/load works through local-dev and Postgres adapters; history list does not return document bodies.
- Free-tier history retention keeps only the latest 100 records per Board by default.

---

## 6. Non-Goals

- No real Auth implementation in this slice.
- No production Email OTP sending.
- No real AI provider calls.
- No Stripe or subscription lifecycle.
- No hard foreign keys that would break current dev fallback records before real users/workspaces exist.
- No full Mixpanel-grade admin dashboard in this schema slice.
- No production admin access before real Auth/session and `admin_roles` checks exist.
