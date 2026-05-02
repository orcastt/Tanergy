# Project State Slice S1A: Database Schema And Migration

**Updated**: 2026-05-02
**Status**: Implemented and locally smoke-tested; staging DB smoke pending S1B resources.

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
- [ ] Run staging Neon/Postgres migration smoke in S1B.

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
- Alembic now normalizes `postgresql://` to `postgresql+psycopg://` so Neon-style URLs work with the project's `psycopg` v3 dependency.
- Local real Postgres smoke passed with disposable Docker Postgres; staging Neon/Postgres smoke still belongs to S1B.

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
