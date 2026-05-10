# S3 Admin Operator Console Redesign Plan

**Created**: 2026-05-09
**Status**: Active tactical plan; Phase A/E/F plus the first arbitrary-workspace invite/member/board row loop are now implemented locally.
**Owner slice**: S3 Admin/Billing/Analytics, with S1C/S1D/S2 dependencies.

## Purpose

Rebuild the developer admin console around the operator mock:

- User inventory is the primary entry point.
- User detail is a dense operations page with five tabs: Billing, Team Plan, Joined Team, Group Plan and Joined Group.
- Actions use centered modals.
- No explanatory helper copy in the UI.
- Frontend must render real aggregated data, not stitch together many slow detail calls.

This is not a database rewrite. Keep the existing Neon/Postgres schema, wallet, subscription, ledger and AiRun facts. Add only the missing admin-read fields, indexes and operations needed by the mock.

## Product Contract

### User Inventory

One row per user, paginated and searchable.

Columns:

- User id
- Email
- IP
- Register state
- Register date
- Team plans
  - active plans in primary text
  - expired/canceled plans in muted text
  - active period below each plan
- Team credit bars per Team wallet
- Group plan
  - current Collaborate plan
  - expired/canceled Collaborate plan history
- Personal credit bar
- Total spent credits across personal, Group and all Teams, including expired plans
- Status with block/unblock action
- Detail action

### User Detail Tabs

Billing:

- Account profile uses the same operational facts as inventory.
- Admin actions: delete account, block/unblock, top up credits, deduct credits.
- Top up/deduct can target personal wallet or a Team wallet owned by the user.
- Each money/credit/plan action writes to billing history with item, amount, Team credits delta, personal credits delta, date and reason.

Team Plan:

- Shows Team workspaces created/bought by this user, active and expired.
- One large row per Team plan.
- Row fields: plan, active period, workspace name, Team credit bar, members, boards, actions.
- Actions: buy seats, freeze, unfreeze, top up, deduct, delete.
- Freeze pauses the subscription from today, blocks Team wallet use, keeps credits and can be reversed.
- Add new plan modal creates a new Team workspace and Team plan.
- Add new plan modal fields: plan, seats, effective mode, duration count, day-per-unit, grant included credits, reason.
- Included credits preview is calculated as `PLAN_CATALOG[plan].includedCredits * seats`.
- Team seat maximum is 15 for `team_start` and `team_growth`.

Joined Team:

- Shows Team workspaces this user joined but does not own.
- Row fields: plan, workspace name, creator email, role, stacked Team credit bar, members, joined boards, leave action.
- Stacked credit bar:
  - black: this user's usage in that Team
  - green: total Team used credits
  - white with green stroke: remaining Team wallet credits
- Admin role rows may expose member/board management actions; editor/viewer rows must not.

Group Plan:

- A user can have only one active Collaborate plan: `collaborate_start` or `collaborate_plus`.
- Collaborate Start can create up to 10 Groups.
- Collaborate Plus can create up to 20 Groups.
- Each Group can have up to 15 members.
- Boards are unlimited.
- Top actions: create new group, change plan.
- Change plan modal has mutually exclusive modes: renew, upgrade, delete.
- Upgrade is disabled when the current plan is already `collaborate_plus`.
- Plan modal uses effective mode, duration count, day-per-unit, grant included credits and reason.

Joined Group:

- Shows Groups this user joined but does not own.
- Row fields: plan, workspace name, creator email, role, credits used by me, members, joined boards, leave action.
- Group rows do not show another member's wallet balance or personal billing.
- Admin role rows may expose group/member/board management actions; editor/viewer rows must not.

## Current Backend Coverage

Already reusable:

- `tangent_users.status` supports active/suspended/deleted.
- `tangent_workspaces.kind/status/owner_id` separates Team, Group and Solo workspaces.
- `tangent_workspace_members.role` supports owner/admin/editor/viewer.
- `tangent_credit_accounts` supports user personal wallets and workspace Team wallets.
- `tangent_credit_ledger` supports credit balance, spend and admin adjustments.
- `tangent_subscriptions` supports owner/workspace, plan family, plan key, seat capacity and periods.
- `/api/v1/admin/finance/manual/*` can top up/deduct user and Team wallets, assign plans, create Team/Group workspaces, cancel subscriptions and delete workspaces with required reasons.
- `/api/v1/admin/directory/*` can list users, owned workspaces, workspace members and boards.

Missing or too thin:

- IP/last seen facts are not reliably stored for inventory.
- Operator inventory now returns active plus expired Team and Collaborate plan arrays, but it still depends on existing subscription facts and thin IP/registration state.
- User detail now has an operator bundle route and a first-pass server-seeded detail page, but billing history still needs fuller payment/subscription/audit merge semantics.
- Joined Team/Group lists by user membership now exist in the operator detail bundle; role-aware member/board actions are still pending.
- Freeze/unfreeze is not an explicit subscription operation yet.
- User block/unblock/delete is not an admin write endpoint yet.
- Member/board actions in admin detail need role-aware operations and guardrails before being enabled.

## Implementation Checkpoint: 2026-05-09

Implemented:

- `GET /api/v1/admin/operator/users`
- `GET /api/v1/admin/operator/users/{user_id}`
- `/admin?tab=users` now renders the operator User inventory with active/expired Team plans, Team credit bars, active/expired Group/Collaborate plans, personal credit, total spent, status and detail navigation.
- `/admin/users/[userId]` now renders Billing, Team Plan, Joined Team, Group Plan and Joined Group from the operator detail bundle.
- `/admin` now uses an access-only server bootstrap so the page can reopen from client-cached Users/Teams/Groups/AI/Finance resources instead of blocking on a full server seed.
- Detail hover/focus now pre-warms the operator detail bundle, and `/admin/users/[userId]` reopens from cached detail when available.
- Detail tab switching is local state; the detail page no longer composes data by fetching every Team/Group panel separately.
- First-pass centered modals now call existing audited manual finance operations for personal top-up/deduct, Team wallet top-up/deduct, Team plan assignment, Team creation, Group creation, Collaborate plan assignment, subscription cancel and workspace delete.
- Arbitrary Team/Group `Invite`, `Add member`, invite revoke, board copy and board delete actions are now server-backed from the operator tables, and pending invites are hydrated inline in the same detail bundle as the member rows.
- Invite/member/board row actions can now patch the visible detail bundle locally after the server mutation returns, so the operator page does not need a second fetch just to show the changed row.

Still pending:

- Joined Team/Group top-level manual join flow if the mock keeps that affordance instead of row-level add-member only.
- Demo seed data for visual QA with richer Team/Group histories.

## Backend Plan

### Phase A: Admin Read Model

Add `admin_operator_*` backend modules and route prefix:

```text
GET  /api/v1/admin/operator/users
GET  /api/v1/admin/operator/users/{user_id}
```

`/users` returns the inventory page:

- paginated user rows
- current and expired Team plan summaries
- current and expired Group/Collaborate plan summaries
- personal wallet summary
- total spent summary
- status/block state

`/users/{user_id}` returns one detail bundle:

- account profile
- billing history
- owned Team plans
- joined Teams
- owned Group plan and owned Groups
- joined Groups

Do not make the frontend fetch every workspace separately after opening detail.

### Phase A.1: Current Code Reconciliation

The repository already has a partial admin bootstrap path and directory reads. The next implementation step should not re-fetch those facts piecemeal from the client.

Current bridge behavior:

- `/admin` and `/admin/users/[userId]` should keep server bootstrap as access-only and let cached operator resources paint immediately when available.
- The client keeps local tab state and cached detail bundles after the first load.
- Existing `admin/directory` and `admin/bootstrap` reads remain reusable for the first pass, but they do not satisfy the final operator bundle shape yet.

The final operator bundle still needs:

- joined Team and Group membership arrays by user
- billing history merged from payments, ledger and audit rows
- explicit freeze/unfreeze state for subscriptions
- user IP / registration-state facts for inventory rows
- modal write endpoints for status, delete and subscription pause control

### Phase B: Small Schema Delta

Add only what the read model and operations require:

- `tangent_users.last_ip_address`
- `tangent_users.registration_state` or derive it from `email_verified/status`; prefer deriving unless product needs a manual state.
- `tangent_subscriptions.paused_at`
- `tangent_subscriptions.paused_by`
- `tangent_subscriptions.pause_reason`
- optional `tangent_subscription_events` if freeze/unfreeze/renew/delete history cannot be cleanly reconstructed from admin audit plus ledger.

Indexes:

- users: status, created_at, email search
- workspace members: user_id, workspace_id, role
- workspaces: owner_id, kind, status
- subscriptions: owner_type, owner_id, workspace_id, plan_family, status, current_period_end
- credit ledger: account_id, workspace_id, actor_user_id, created_at
- admin audit: target_user_id, workspace_id, created_at

### Phase C: Admin Writes

Add server-gated, audited endpoints:

```text
POST /api/v1/admin/operator/users/{user_id}/status
POST /api/v1/admin/operator/users/{user_id}/delete
POST /api/v1/admin/operator/subscriptions/{subscription_id}/freeze
POST /api/v1/admin/operator/subscriptions/{subscription_id}/unfreeze
POST /api/v1/admin/operator/workspaces/{workspace_id}/leave-member
```

All writes require `reason`.

Rules:

- Block maps to `tangent_users.status = 'suspended'`.
- Unblock maps to `active`.
- Delete is soft-delete: `status = 'deleted'`, revoke sessions, preserve audit/ledger.
- Freeze maps to subscription pause and makes entitlement/preflight treat it as not active.
- Unfreeze restores active/trialing state and can extend the period by paused duration in a later proration pass.
- Leave member uses workspace membership rules and must not let the owner leave through the wrong path.

### Phase D: Seeded Demo Data

Because local data is thin, add a dev-only seed script:

```text
services/api/scripts/seed_admin_operator_demo.py
```

Implemented on 2026-05-10. The script is namespace-based, can clean and reseed the same demo bundle, and refuses non-local database hosts unless the operator passes `--allow-remote`.

It creates:

- 3 to 5 users
- active and expired Team plans
- active and expired Collaborate plans
- Team wallets with ledger usage/top-ups/deductions
- Group personal usage
- joined Team and joined Group memberships
- boards and member roles

The script must be opt-in and never run in production automatically.

## Frontend Plan

### Phase E: Admin Inventory UI

Replace the Users tab with a full-width inventory table:

- rows are tall and scan-friendly
- no card grid
- no helper copy
- search and pagination stay visible
- clicking Detail routes to the user detail bundle
- use compact bars for credit usage

Components:

```text
AdminUserInventoryPage
AdminUserInventoryRow
AdminCreditBar
AdminPlanStack
AdminStatusAction
```

### Phase F: User Detail UI

Replace current user detail layout with five local tabs:

```text
Billing | Team Plan | Joined Team | Group Plan | Joined Group
```

The first render uses the detail bundle and keeps tab state locally. No tab should trigger a fresh access check or slow reload after the bundle is loaded.

### Phase G: Modals

Use one centered modal shell for:

- top up credits
- deduct credits
- add Team plan
- change Collaborate plan
- create Group
- block/unblock
- delete user
- freeze/unfreeze
- delete plan/workspace

Every modal includes reason. Destructive operations use explicit confirm buttons.

### Phase H: Role-Aware Actions

Buttons should render from server-provided permissions, not frontend guessing.

Examples:

- Joined Team admin: member add/delete/change role, board delete/copy.
- Joined Team editor/viewer: no management actions.
- Joined Group admin: group/member/board management.
- Joined Group editor/viewer: leave only plus allowed non-admin actions.

## Acceptance

- Inventory loads with one API request and does not need per-user detail calls.
- Opening user detail loads one bundle request; switching tabs is instant.
- Inventory shows active and expired Team and Group plans separately.
- Billing tab can top up/deduct personal or Team credits through centered modals and billing history updates after mutation.
- Team Plan tab can add Team plan, buy seats, freeze/unfreeze, top up/deduct and delete.
- Group Plan tab enforces one active Collaborate plan, 10/20 Group limits and 15-member Group limit in UI and backend.
- Joined Team and Joined Group do not leak another user's personal wallet.
- All writes are server-gated by `admin_roles` and audited with reason.
- Empty local data can be populated by the opt-in demo seed.

## Implementation Order

1. Backend read model schemas and tests for inventory/detail bundle.
2. Minimal schema delta for IP and freeze/unfreeze state.
3. Admin write endpoints for block/unblock/delete/freeze/unfreeze.
4. Dev-only demo seed script.
5. Frontend inventory table using real bundle fields.
6. Frontend user detail five-tab layout and modal shell.
7. Hook existing manual finance writes into the new modals.
8. Role-aware joined Team/Group management actions.
9. Local smoke with demo data and real Neon/local Postgres.

## Open Decisions

- Whether user IP should mean last login IP, registration IP or both.
- Whether freeze should extend `current_period_end` automatically on unfreeze in P0, or just pause entitlement until manually adjusted.
- Whether account delete should revoke all workspace ownership immediately or leave owned workspaces suspended for support review.
- Whether Group create limit counts deleted Groups or only active Groups.
