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
POST /api/v1/billing/teams/checkout
  -> create pending team_subscription payment owned by the buyer's personal context

payment completed
  -> create team_workspace
  -> create owner/admin workspace_members row
  -> create workspace-owned credit_account(account_kind=team_wallet)
  -> create subscription(plan_key=team_start|team_growth, seat_capacity=n)
  -> write payment/invoice/webhook facts
  -> write subscription_grant credit_ledger entry to Team wallet
  -> audit admin/system facts
```

Implementation checkpoint: the backend checkout/complete contract exists with manual-test payment completion. Checkout responses now include a `checkout` object; non-manual providers require hosted checkout configuration before a payment is created, can expose a hosted checkout URL with amount/currency/kind/client-reference handoff metadata and cannot be manually completed. The payment layer is provider-neutral: `manual_test` and generic hosted checkout can keep staging moving while Stripe is unavailable. The optional Stripe checkout adapter first cut requires `TANGENT_STRIPE_SECRET_KEY` only when `stripe` is selected, creates Checkout Sessions through Stripe's server API, writes internal payment/session references into provider metadata and labels `checkout.adapter=stripe_checkout`; it does not read local secret files. A first signed webhook inbox also exists: `POST /api/v1/billing/webhooks/{provider}` validates `TANGENT_PAYMENT_WEBHOOK_SECRET`, stores provider events in `tangent_webhook_events`, calls the shared payment completion path for supported checkout success events by internal payment id, client reference or provider metadata checkout session id and avoids duplicate grants for repeated provider event ids. The frontend now has hosted checkout return routes at `/billing/success` and `/billing/cancel`, and `/usage` buttons call the real Team top-up, Team seat checkout, personal top-up and Group create routes. Admin finance reconciliation now has server-gated read endpoints and frontend panels for payments, credit ledger rows, subscriptions, wallets and Team member usage. Local disposable-Postgres smoke now covers admin finance reads plus manual-test and hosted payment flows; remote staging still needs a redeploy before real-login smoke can pass. Provider-specific signatures, invoices, refunds and production payment reconciliation still need implementation.

Team seat add:

```text
owner/admin checkout
  -> update subscription seat_capacity
  -> grant incremental included credits to Team wallet
  -> allow assigning seats to active/invited members up to capacity
```

Team wallet top-up:

```text
owner/admin checkout in active team_workspace
  -> create workspace_topup payment owned by the Team wallet
  -> payment completed writes topup_purchase to the workspace-owned credit_account
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

Implementation checkpoint: `/api/v1/billing/collaborate/checkout` and payment completion now create/update the user's single active Collaborate subscription and grant included credits to the personal wallet.

Group create:

```text
POST /api/v1/workspaces/groups
  -> require active user-owned Collaborate subscription
  -> create group_workspace
  -> create owner workspace_members row
  -> future invites share Boards while AI spend stays actor-personal
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

Implementation checkpoint: backend workspace invite create/list/accept/revoke/expiry contracts exist. Invite tokens are stored only as hashes. The current first cut verifies token state and optional target email/user, then creates/updates workspace membership. Team invite accept also requires an active Team subscription with remaining seat capacity and creates the member's seat assignment without granting duplicate credits. Team and Group dashboard surfaces now load the server dashboard when available and wire invite/create/revoke, member remove, member role update and Team seat assignment actions to the real routes. Email delivery, board-specific assignment UI and audit events remain.

Member removal:

```text
owner/admin removes member
  -> prevent owner removal/self-removal through this endpoint
  -> delete workspace_members row
  -> if team_workspace, revoke active workspace_seat_assignments for that member
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
GET  /api/v1/admin/finance/summary
GET  /api/v1/admin/finance/payments
GET  /api/v1/admin/finance/wallets
GET  /api/v1/admin/finance/subscriptions
GET  /api/v1/admin/finance/credit-ledger
GET  /api/v1/admin/finance/member-usage
```

Exact route names may change, but the capabilities and server authority must remain.

## Current State

Reusable:

- Server-gated Admin and audit log scaffolds.
- Billing/team/usage first-pass UI, including real `/usage` checkout/create button wiring and billing success/cancel return routes.
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
- Team top-up targets the Team wallet.
- Collaborate checkout enforces the single active personal Collaborate subscription contract and grants credits to the personal wallet.
- Hosted checkout response contract exists for non-manual providers; missing hosted checkout configuration fails before payment creation and manual completion is blocked for hosted-provider payments.
- Provider-neutral checkout first cut supports manual-test and generic hosted checkout; the optional Stripe adapter requires server-side `TANGENT_STRIPE_SECRET_KEY` only when selected, creates Stripe Checkout Sessions and labels checkout responses with `adapter=stripe_checkout`.
- Signed payment webhook inbox first cut records provider events and completes top-up/subscription payments through the shared grant path by internal payment id, client reference or provider metadata checkout session id with duplicate-event idempotency.
- Admin finance reconciliation first pass exposes server-gated summary, payment, wallet, subscription, credit ledger and Team member usage read APIs, with matching frontend panels and audit-log entries.
- Workspace invite create/list/accept/revoke and member removal contracts exist for Team and Group.
- Mock AI run settlement now has contract coverage for Group actor-personal charging, Team wallet charging and immutable charge context during polling/cancel.
- Disposable Postgres smoke passed for migration-to-head, Team checkout/invite/quote/run-settlement/remove and Collaborate/Group create/invite/quote/run-settlement.
- Local admin/payment smoke passed for `/admin` finance panel reads, manual-test Team wallet top-up, manual-test Team seat checkout plus assignment, and hosted checkout redirect/manual-complete rejection.

Remaining rework:

- Hosted staging smoke still needs to run against managed Postgres and deployed API/Web; current remote Web/API returned 404 for `/admin` and `/api/v1/admin/finance/*` before redeploy.
- Hosted live-provider run-settlement smoke still needs to exercise real provider output persistence through the same payer contract.
- Provider-specific webhook signatures, invoice/refund handling and deployed staging smoke must replace manual-test completion as the authority for grants and subscription state.
- Email invites, board-specific assignment UI and richer audit events remain.
- GeekAI canvas fast path must be reconciled into S2 server provider-route/billing control plane before production reliance.
