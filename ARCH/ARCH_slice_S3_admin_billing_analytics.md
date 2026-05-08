# ARCH Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-08
**Mode**: Architecture slice.
**Status**: Active architecture pivot. Existing admin, ledger, seat, subscription and AiRun facts are reusable, but Team charging must move to a workspace-owned Team wallet.

## Scope

Server authority and data contracts for:

- Team purchase, workspace creation, member roles, seats and Team wallet.
- Group/Collaborate subscription, Group workspaces and personal-wallet charging.
- Invite links and invite acceptance.
- Billing usage, top-ups, seat additions, subscription lifecycle and ledger facts.
- Admin/developer observability for users, teams, boards, AiRuns, provider routes, costs and credits.

## Authority Rules

- Product plans are not Auth roles.
- Workspace roles are not global admin roles.
- Board roles are not billing visibility.
- Frontend may request an active workspace, model and parameter tier, but the server resolves membership, permission, payer, route and price.
- Provider secrets, raw provider routes and provider pricing stay server-side.
- Board documents, node props and Board History store compact refs and summaries only.

## Workspace And Wallet Model

Workspace kinds:

```text
solo_workspace
group_workspace
team_workspace
enterprise_workspace
```

Plan families:

```text
free_canvas
collaborate_start
collaborate_plus
team_start
team_growth
enterprise
```

Credit accounts:

```text
credit_accounts.owner_type = user | workspace
credit_accounts.owner_id   = tangent_users.id | tangent_workspaces.id
credit_accounts.account_kind target = personal_wallet | team_wallet | enterprise_pool
```

Implementation note: if the current database lacks `account_kind`, add it or store the equivalent in a constrained metadata column during the next S3 migration. The important invariant is that Team credits are workspace-owned, while Collaborate credits are user-owned.

Subscriptions:

```text
subscriptions.account_id -> credit_accounts.id
subscriptions.plan_key
subscriptions.plan_family = free | collaborate | team | enterprise
subscriptions.status
subscriptions.seat_capacity
subscriptions.current_period_start/end
provider_subscription_id / provider_customer_id
```

Constraints:

- One user may have only one active `collaborate_*` subscription.
- One user may own or belong to many `team_workspace` records.
- Each Team workspace has its own wallet, subscription, seat capacity, members, Boards, usage rollups and ledger.
- Team seat assignment controls membership capacity and usage attribution; it does not create the payer account.

## Payer Resolution Matrix

| Context | Required permission | Charged account | Visibility |
| --- | --- | --- | --- |
| Solo/free Board | Board edit/run permission and personal balance | Actor personal wallet | Actor only |
| Group/Collaborate Board | Board edit/run permission and actor personal balance | Actor personal wallet | Actor only; Group admin sees structure, not billing |
| Team Board | Board edit/run permission, active Team membership, Team wallet balance | Team wallet for the active Team workspace | Team owner/admin sees member and Team usage |
| Enterprise Board | Contract-specific permission | Enterprise workspace pool or contract-defined account | Contract-defined |

Recommended charge scopes:

```text
actor_personal
team_wallet
enterprise_workspace_pool
```

If the current code can only store `workspace_pool`, use `charged_scope=workspace_pool` plus `entitlement_source=team_wallet` until the enum is widened. Do not let the frontend infer this.

## Purchase And Invite Flows

Team purchase:

```text
checkout completed
  -> create team_workspace
  -> create owner/admin workspace_members row
  -> create workspace-owned credit_account(account_kind=team_wallet)
  -> create subscription(plan_key=team_start|team_growth, seat_capacity=n)
  -> write payment/invoice/webhook facts
  -> write subscription_grant credit_ledger entry to Team wallet
  -> audit admin/system facts
```

Team seat add:

```text
owner/admin checkout
  -> update subscription seat_capacity
  -> grant incremental included credits to Team wallet
  -> allow assigning seats to active/invited members up to capacity
```

Collaborate purchase:

```text
checkout completed
  -> ensure user personal_wallet
  -> enforce no other active collaborate subscription
  -> create/update user subscription(collaborate_start|collaborate_plus)
  -> write subscription_grant to personal wallet
  -> allow Group creation/invite flows according to plan limits
```

Invite acceptance:

```text
create invite link/email invite
  -> store workspace_id, target role, inviter, expiry, optional target email
  -> signed-in recipient accepts
  -> server verifies token, expiry, workspace policy and seat capacity if Team
  -> create/update workspace_members
  -> optional board_members grant
  -> audit membership change
```

## Permission Boundaries

Workspace roles:

```text
owner/admin/editor/viewer
```

Board roles:

```text
owner/admin/editor/viewer/temporary_viewer
```

User-facing Board labels:

```text
Owner      -> owner
Can manage -> admin
Can edit   -> editor
Can view   -> viewer | temporary_viewer
```

Rules:

- Board `Can edit` allows content editing but not AI execution by itself.
- Board `Can manage` allows invite/share/rename/visibility/member management but not owner-only copy/delete.
- Team billing visibility requires Team workspace owner/admin, not Board admin.
- Group admin/editor/viewer roles do not expose another member's wallet or usage.
- Public share links remain view-only until a separate editor-via-share product decision exists.

## AiRun Charge Contract

```text
Node Run click
  -> ApiRequestContext resolves actor user + active workspace
  -> WorkspaceAccessService resolves workspace kind and membership
  -> BoardPermissionService resolves Can view/edit/manage/Owner
  -> BillingEntitlementService resolves subscription, wallet and payer policy
  -> ModelPricingService resolves model tier, pricing rule and estimate
  -> AiChargePreflight checks permission, balance, rate limit and model allowance
  -> create ai_run with actor/workspace/board/node/model/tier/pricing/route/charged_account
  -> ProviderRouteService chooses route server-side
  -> provider adapter executes
  -> Asset service stores outputs
  -> CreditLedgerService settles usage/refund
  -> ApiCostLedgerService stores provider cost facts
```

Required persisted run facts:

```text
actor_user_id
workspace_id
workspace_kind
board_id
node_id
product_model_key
selected_tier_key
pricing_rule_id
route_id
charged_account_id
charged_scope
entitlement_source
credits_estimated
credits_charged
credits_refunded
provider_cost
provider_currency
```

## Required Database Delta

The next migration should confirm or add:

- `credit_accounts.account_kind` or equivalent constrained metadata.
- `subscriptions.plan_family`, `seat_capacity`, current-period columns and provider ids.
- Partial unique index for one active Collaborate subscription per user.
- Team workspace purchase linkage: payment/subscription -> workspace -> wallet.
- Workspace invite tokens with expiry/revoke/acceptance state.
- Seat capacity and member assignment facts that do not imply personal credit ownership.
- `ai_runs.node_id` if node-level attribution is not already durable.
- Charge-scope widening or `entitlement_source=team_wallet` compatibility mapping.

## Planned API Capability Map

Auth/workspace:

```text
GET  /api/v1/auth/session
GET  /api/v1/workspaces
POST /api/v1/workspaces/groups
POST /api/v1/billing/teams/checkout
POST /api/v1/billing/collaborate/checkout
```

Invites/members:

```text
POST /api/v1/workspaces/{workspaceId}/invites
GET  /api/v1/workspace-invites/{token}
POST /api/v1/workspace-invites/{token}/accept
GET  /api/v1/workspaces/{workspaceId}/members
PATCH /api/v1/workspaces/{workspaceId}/members/{userId}
DELETE /api/v1/workspaces/{workspaceId}/members/{userId}
```

Billing/wallet:

```text
GET  /api/v1/billing/me
GET  /api/v1/billing/team/{workspaceId}
POST /api/v1/billing/topups/personal/checkout
POST /api/v1/billing/topups/team/{workspaceId}/checkout
POST /api/v1/billing/team/{workspaceId}/seats/checkout
GET  /api/v1/credits/ledger
GET  /api/v1/workspaces/{workspaceId}/usage
```

AI/admin:

```text
POST /api/v1/ai/runs/quote
POST /api/v1/ai/runs
GET  /api/v1/admin/ai/runs
GET  /api/v1/admin/ai/api-calls
GET  /api/v1/admin/credits/accounts
GET  /api/v1/admin/credits/ledger
```

Exact route names may change, but the capabilities and server authority must remain.

## Current State

Reusable:

- Server-gated Admin and audit log scaffolds.
- Billing/team/usage first-pass UI.
- `workspace.kind`, membership, seat assignment, usage/dashboard facts.
- Credit ledger helpers and preflight/read routes.
- Payment checkout/complete scaffolds.
- S2 model/route/pricing control plane, AiRun lifecycle and provider-cost facts.
- Board permission resolver and share/member first pass.

Implemented in the 2026-05-08 first cut:

- Migration `20260508_0012` adds wallet account kind, subscription ownership/family/seat capacity, one-active Collaborate and Team workspace subscription indexes, invite token facts and `team_wallet` charge scope.
- Team payer resolver now returns the workspace-owned Team wallet for Team entitlement/quote.
- Team seat assignment now grants included credits to the Team wallet instead of a member personal wallet.
- Team seat checkout completion now writes Team subscription ownership/seat-capacity facts and a Team wallet subscription grant.

Remaining rework:

- Team top-up must target the Team wallet.
- Collaborate checkout must enforce one active personal Collaborate subscription at the route/service layer; the database index now exists.
- Workspace invite acceptance must become product-grade for Team and Group.
- GeekAI canvas fast path must be reconciled into S2 server provider-route/billing control plane before production reliance.
