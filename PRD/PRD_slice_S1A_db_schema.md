# PRD Slice S1A: Database Schema And Migration

**Updated**: 2026-05-02
**Status**: Implemented and locally smoke-tested; staging DB smoke pending S1B resources.

## User Value

Users can trust that their Boards, uploads and account data belong to them. Future AI credits, team billing, Admin support and collaboration can attach to the same data model without rewrites.

## Requirements

- [x] Formalize user, workspace, Board, Board History and Asset schema.
- [x] Add Board membership and per-user Board preferences.
- [x] Add future-compatible tables for Admin audit, AI usage and credit ledger.
- [x] Preserve existing local/staging Board data during migration through additive migrations and `NOT VALID` hardening constraints.
- [x] Define indexes for cursor pagination and common filters.
- [x] Provide a guarded Postgres smoke runner for empty DB and P0-seeded DB migration checks.
- [x] Run real empty-database and migrated-P0 smoke against disposable Docker Postgres.
- [ ] Run real empty-database and migrated-P0 smoke against staging Postgres in S1B.

## Must-Have Tables

```text
users
user_identities
auth_sessions
email_otps
oauth_accounts
workspaces
workspace_members
boards
board_members
board_user_preferences
board_share_links
board_snapshots
assets
asset_variants
board_assets
```

## Future-Compatible Tables

```text
admin_roles
admin_audit_logs
credit_accounts
credit_ledger
subscriptions
webhook_events
model_options
model_provider_routes
ai_runs
ai_api_calls
analytics_events
moderation_items
```

Note: current code keeps the P0 `tangent_model_options` table as the model registry scaffold. S2 should decide whether to formalize it in place or migrate it to `tangent_model_registry`.

## Acceptance

- Migration from empty DB succeeds. Passed locally with disposable Docker Postgres; staging smoke pending S1B.
- Migration from current P0 scaffold succeeds. Passed locally with disposable Docker Postgres; staging smoke pending S1B.
- Schema can represent private/public Board, members, owner/editor/viewer and per-user pin/star/opened state.
- Schema can represent personal and team credit accounts later.
- Schema can connect AI runs to user/workspace/board/node/model/provider later.
- Staging optimization should be based on measured query plans for Board, History, Asset, AiRun and Admin list views, not speculative index additions.
