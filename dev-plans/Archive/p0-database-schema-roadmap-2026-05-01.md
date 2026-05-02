# P0 Database Schema Roadmap

**Status**: Archived superseded pointer.

The previous long database roadmap has been moved out of active context to avoid duplicating architecture and project-state truth.

Use these active files instead:

- `../../ARCH/ARCH_slice_S1_persistence_auth_deploy.md` for current and target persistence schema.
- `../../ARCH/ARCH_slice_S3_admin_billing_analytics.md` for Admin, credits, billing, analytics and moderation fact sources.
- `../../PRD/PRD_slice_S1_staging_auth_board.md` for product acceptance around Auth-backed Board CRUD.
- `../../project_state/project_state_slice_S1_staging_auth_board.md` for current staging/Auth readiness.

## Current Database State

- Postgres adapters exist for Board, Asset and Board Snapshot persistence.
- Alembic scaffold exists.
- Local-dev auto-create fallback still exists.
- Real users/workspaces/auth/session tables are planned, not product-complete.

## Next DB Work

1. Run staging Postgres migrations.
2. Smoke Board save/load/history against staging Postgres.
3. Add real Auth tables and request-context resolution.
4. Add workspace and Board membership permission checks.

This archived file is not active truth.
