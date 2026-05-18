# Project State Slice S1A: Database Schema And Migration

**Updated**: 2026-05-18
**Status**: S1A core implemented and locally smoke-tested through `20260502_0006`; current migration head also includes S3 entitlement/AI-charge extension `20260506_0007`, the S3 Team-wallet/personal-wallet delta `20260508_0012`, and later S2/S3 control-plane migrations through the current Alembic head. The fresh Supabase Pro staging database has now run `alembic upgrade head`; data-preserving migration of the retired Neon/Hetzner-local staging data is intentionally not part of the current clean rebuild.

## Objective

Create the formal schema and migrations that S1C Auth, S1D Board CRUD, S2 AI, S3 Admin/Billing and S4 Collaboration can all trust.

## Work Items

- [x] Audit existing P0 migrations against target schema.
- [x] Add formal tables for `board_members`, `board_user_preferences`, `board_assets`, `oauth_accounts`.
- [x] Add compatibility tables for Admin, Credits, AI calls, analytics and webhooks.
- [x] Add check constraints and foreign keys.
- [x] Add cursor pagination indexes.
- [x] Add SQL fixtures for two users and two workspaces.
- [x] Add local migration contract test for revision chain and required schema contracts.
- [x] Add guarded local Postgres smoke runner for empty DB and P0-seeded DB migration checks.
- [x] Run real migration smoke from empty database against disposable Docker Postgres.
- [x] Run real migration smoke from current P0 scaffold data against disposable Docker Postgres.
- [x] Run fresh Supabase Pro staging `alembic upgrade head` in S1B.

## Implemented Files

```text
services/api/migrations/versions/20260502_0004_s1a_core_schema.py
services/api/migrations/versions/20260502_0005_s1a_future_systems_schema.py
services/api/migrations/versions/20260502_0006_s1a_constraints_indexes.py
services/api/migrations/fixtures/s1a_two_users_two_workspaces.sql
services/api/scripts/s1a_migration_smoke.py
services/api/tests/test_migration_contracts.py
```

## Current Notes

- S1A is additive and does not drop P0 Board/Asset/History data.
- New FK/check hardening on scaffold tables uses `NOT VALID` so legacy staging rows can be cleaned before constraint validation.
- `board_members` becomes the future Board permission authority.
- `board_user_preferences` holds per-user pin/star/recent-open facts; current API still reads legacy board columns until S1D rewires queries.
- `credit_accounts` supports both personal and team/workspace credit pools.
- New S3 product rule: Team workspaces use a workspace-owned Team wallet; Collaborate/Group uses a user-owned personal wallet. Migration `20260508_0012` adds account-kind constraints, subscription ownership/family/seat-capacity fields, one-active Collaborate index, Team workspace subscription index, invite token facts and `team_wallet` charge scope.
- Alembic now normalizes `postgresql://` to `postgresql+psycopg://` so managed Postgres URLs work with the project's `psycopg` v3 dependency.
- Local real Postgres smoke passed with disposable Docker Postgres; fresh Supabase Pro staging Alembic-to-head passed during the 2026-05-18 clean rebuild. The old Neon and Hetzner-local fallback data were deliberately not migrated.
- Migration `20260506_0007_workspace_entitlements_ai_charge_contract` is a later S3 extension on top of the S1A foundation. It adds workspace kind, seat assignment, usage/dashboard facts and AiRun charge fields.

## Local Smoke Runner

Use only with a disposable Postgres database. The script drops `tangent_%` tables and `alembic_version`.

```bash
S1A_SMOKE_DATABASE_URL=postgresql://user:password@localhost:5432/tangent_s1a_smoke \
S1A_SMOKE_ALLOW_RESET=1 \
PYTHONPATH=services/api \
python3 services/api/scripts/s1a_migration_smoke.py
```

It runs:

```text
empty database -> alembic head
P0 scaffold seed -> alembic head
```

## Validation

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
python3 -m py_compile services/api/scripts/s1a_migration_smoke.py
git diff --check
```

Latest local validation:

```text
PYTHONPATH=services/api python3 -m pytest services/api/tests
  20 passed
python3 -m compileall services/api/tangent_api services/api/migrations
  passed
python3 -m py_compile services/api/scripts/s1a_migration_smoke.py
  passed
Docker S1A migration smoke with disposable Postgres
  empty database -> alembic head: passed
  P0 scaffold seed -> alembic head: passed
```

## Handoff Notes

- Do not implement full Stripe, Admin dashboard or collaboration here.
- Do make their future joins explicit.
- Next migration after `0012` should focus on the remaining workspace invite acceptance and purchase lifecycle facts that are not yet backed by routes/webhooks.
- Next database optimization pass should happen against Supabase staging data/query plans: collect `EXPLAIN` for Board list, History list, Asset list and future AiRun/Admin list queries, then add only measured indexes or retention/size limits.
