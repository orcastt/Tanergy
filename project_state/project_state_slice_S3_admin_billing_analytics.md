# Project State Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-08
**Status**: Active pivot slice. Admin, ledger, usage, seat, checkout and AI-control-plane scaffolds exist. Phase 1/2/3 development has started: migration `20260508_0012` adds Team/Group wallet schema facts, migration `20260508_0013` widens workspace roles for `admin/editor/viewer`, the first payer resolver cut now makes Team workspaces charge a Team wallet while Group/Collaborate workspaces charge the actor personal wallet, Team purchase can provision a Team workspace and Team wallet, and Collaborate purchase can activate the user's single personal Collaborate subscription.

## Current Truth

Reusable first-pass work:

- `/admin` is server-gated, reads summary/users/workspaces/boards/audit facts, exposes finance reconciliation panels and supports audited owner-only admin role changes.
- `/admin` AI panels can inspect/edit model, provider-route and pricing facts, with versioned publish/rollback.
- `/billing`, `/team` and `/usage` first-pass screens exist.
- Backend billing/entitlement reads exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Team seat list/upsert/revoke and workspace member-role mutation exist for the current workspace.
- `credit_accounts`, `credit_ledger`, preflight reads and internal grant/top-up/usage/refund/admin-adjustment helpers exist.
- Payment checkout/complete scaffolds exist for top-ups and seat capacity. Non-manual checkout responses can now expose a hosted checkout URL with amount/currency/kind/client-reference handoff metadata, missing hosted checkout configuration fails before payment creation, and hosted-provider payments cannot be manually completed. The payment layer is provider-neutral, so `manual_test` and generic hosted checkout can keep staging moving while Stripe is unavailable. The optional Stripe checkout adapter first cut requires `TANGENT_STRIPE_SECRET_KEY` only when `stripe` is selected, creates Checkout Sessions through Stripe's server API and labels `checkout.adapter=stripe_checkout` without reading local secret files. A signed provider webhook inbox records provider events and routes successful checkout events through the same completion/grant path by internal payment id, client reference or provider metadata checkout session id, but provider-specific signatures and invoice/refund reconciliation are not production-complete.
- AiRun quote/preflight/lifecycle, model-route-pricing facts, provider-cost facts and attempt-level admin runtime views exist.
- The canvas GeekAI fast path proves UX for image generation/edit/reference, analysis, chat and prompt optimization, but is not yet the production control-plane path.
- Migration `20260508_0012_team_group_wallet_contracts` now adds account kind, subscription ownership/family/seat capacity, one-active Collaborate and one-active Team workspace subscription indexes, workspace invite token facts and `team_wallet` charge scope.
- `workspace_entitlements` now resolves Team charge summaries to `chargedScope=team_wallet`, `entitlementSource=team_wallet` and the workspace-owned Team wallet account. Group/Collaborate remains `actor_personal`.
- Team seat assignment now grants included credits to the Team wallet instead of the assigned member's personal wallet.
- Team seat checkout completion now writes Team subscription ownership/seat-capacity facts and grants included credits into the Team wallet.
- `/api/v1/billing/teams/checkout` now creates a pending Team subscription payment from a personal context; completing that payment provisions the new `team_workspace`, owner membership, workspace-owned Team wallet, Team subscription, seat capacity and first included-credit grant.
- `/api/v1/billing/workspaces/current/topups/checkout` now creates a Team wallet top-up payment for the current Team workspace; completion writes `topup_purchase` into the workspace-owned Team wallet ledger.
- `/api/v1/billing/topups/checkout` remains the personal-wallet top-up path; completion writes `topup_purchase` into the acting user's personal wallet.
- `/api/v1/billing/collaborate/checkout` now creates a personal Collaborate subscription payment; completing it upserts the user's single active `collaborate_start`/`collaborate_plus` subscription and grants included credits to the personal wallet.
- `/api/v1/billing/webhooks/{provider}` now verifies `TANGENT_PAYMENT_WEBHOOK_SECRET` HMAC signatures, records `tangent_webhook_events`, completes supported checkout success events through the shared payment completion path by payment id, client reference or provider metadata, and returns duplicate provider events without double-granting credits.
- `/api/v1/admin/finance/*` now exposes server-gated summary, payment, wallet, subscription, credit ledger and Team member usage read APIs, with matching frontend panels and audit events for finance/admin/owner/analyst roles.
- `/api/v1/workspaces/groups` now creates a `group_workspace` and owner membership, gated by an active personal Collaborate subscription.
- `/api/v1/workspaces/current/invitations` and `/api/v1/workspaces/invitations/{token}/accept` now provide backend invite link create/list/accept/revoke and expiry contracts. Tokens are stored as hashes, accepted invites create/update workspace membership with `admin/editor/viewer` roles, and Team invite accept enforces active subscription seat capacity before creating a seat assignment.
- `DELETE /api/v1/workspaces/current/members/{user_id}` now removes workspace members; for Team workspaces it also revokes active seat assignments.
- Frontend first-pass wiring now exposes billing plan checkout/complete, Team create/purchase, Group create, invite accept, invite create/revoke, role-gated member removal, role update, Team seat assignment, `/usage` Team top-up, Team seat checkout, personal top-up and Group create actions. Team/Group dashboards load the server workspace dashboard when available. Hosted checkout redirects and `/billing/success` plus `/billing/cancel` return routes exist; final wallet/subscription state still depends on provider webhook completion.
- Backend AI run settlement contract tests now cover both Group/Collaborate actor-personal charging and Team workspace Team-wallet charging, and polling/cancel requests preserve the original run charge context.
- Disposable Postgres smoke passed on 2026-05-08: empty DB and P0-seeded DB migrate to head; Team checkout creates a Team workspace/wallet, invite accept works, Team quote/run settlement resolves and charges `team_wallet`, member removal works; Collaborate checkout creates a Group, Group invite accept works and Group quote/run settlement resolves and charges `actor_personal`.
- Local admin/payment smoke passed on 2026-05-08: `/admin` loaded the finance panel against a disposable Postgres-backed API and every admin finance read returned 200; manual-test Team wallet top-up completed into the Team wallet ledger; manual-test Team seat checkout completed and allowed a Team seat assignment; hosted checkout returned a `hosted_redirect` URL and rejected manual completion with the expected webhook-only 409.
- Remote staging smoke is blocked until redeploy: `https://staging.tanergy.cc/admin`, `https://api-staging.tanergy.cc/api/v1/admin/me` and `https://api-staging.tanergy.cc/api/v1/admin/finance/summary` returned 404 while `https://api-staging.tanergy.cc/health` returned 200.

## Product Rule Drift

The older S3 plan assumed Team Start/Growth charged the acting member's own seat-backed account. That is now superseded.

New rule:

- Team purchase creates an isolated Team workspace and Team wallet.
- Team seats add capacity and included credits to the Team wallet.
- Team top-ups credit the Team wallet.
- Team AI runs charge the Team wallet.
- One user may buy/own multiple Teams.
- Collaborate Start/Plus are personal subscriptions; one user may have only one active Collaborate subscription.
- Group workspace Boards are shared, but AI spend charges the acting user's personal wallet.

## What Must Be Redone Or Hardened

1. Payer resolver: Team workspace runs must resolve to a workspace-owned Team wallet. First cut implemented for entitlement/quote.
2. Subscription model: Team subscriptions must be workspace-owned; Collaborate subscriptions must be user-owned and single-active per user. Backend checkout/upsert first cut implemented.
3. Seat lifecycle: seat capacity/member assignment must not imply per-member credit ownership. Seat grant first cut now writes Team wallet.
4. Wallet grants: Team plan grants and top-ups write to the Team wallet; Collaborate grants/top-ups write to personal wallet. Backend Team subscription, seat and top-up grants now write Team wallet; hosted checkout response metadata and signed webhook authority first cuts now exist.
5. Workspace purchase flow: backend contract first cut implemented for Team checkout completion; frontend action wiring, hosted checkout response contract, provider-neutral checkout adapter, Stripe Checkout Session first cut, signed webhook inbox with provider metadata lookup, disposable Postgres smoke and local manual/hosted payment smoke now exist; deployed staging smoke remains.
6. Invite and member lifecycle: backend Team/Group invite create/accept/revoke/expiry, Team seat-capacity-on-accept, role assignment and member removal first cut implemented; frontend action wiring now includes invite/revoke/remove/role-update/seat-assign with owner/admin gating, while email sending and board-specific assignment UI remain.
7. Permission services: Board roles, workspace roles, Team billing visibility and AI payer eligibility must stay separate.
8. Admin monitoring: every production AiRun must be queryable by user, team/workspace, board, node, model, route, pricing rule, charged account and provider cost. Finance first pass now also surfaces payments, wallets, subscriptions, credit ledger and Team member usage.
9. GeekAI reconciliation: local Next routes must become thin/product-proof paths behind server AiRun or be marked development-only.

## Current Active Slice

```text
S3 Team/Group Wallets + Membership/Billing
  depends on S1A schema delta
  depends on S1C registration/workspace selection hardening
  depends on S1D permission and invite hardening
  depends on S2 payer resolver + provider-route settlement
```

The implementation checklist now lives in:

```text
dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md
```

## Validation Target For Next Checkpoint

- A new Team checkout can create an isolated Team workspace and Team wallet in backend contract tests and disposable Postgres smoke; hosted staging smoke remains.
- A Team owner can create invite links, accept/revoke/expire invites with seat-capacity enforcement, assign role, remove member with seat revoke, and add seats; frontend first-pass wiring, owner/admin role gating and disposable Postgres smoke exist, while email/deployed staging smoke remain.
- A Team AI quote resolves `charged_account_id` to the Team wallet. Covered by backend tests.
- A Group AI quote resolves `charged_account_id` to the actor's personal wallet. Covered by backend tests.
- Team and Group mock AI run settlement writes usage charges to the resolved account. Covered by backend contract tests and disposable Postgres run-settlement smoke; hosted live-provider smoke still remains for the next staging checkpoint.
- A user cannot activate both Collaborate Start and Collaborate Plus at the same time. Backend checkout upserts the single active subscription and migration keeps the DB constraint.
- Admin runtime views can filter a run by user, workspace/team, board, model, route and charged account; admin finance views can reconcile payment, wallet, subscription, ledger and Team member usage facts.

## Not Production-Complete

- Provider-specific signatures, deployed staging payment smoke, invoices, refunds and production reconciliation.
- Subscription renewal/cancellation automation.
- Production-grade seat proration and downgrade policy.
- Deeper admin finance views for invoices, refunds, provider health and revenue rollups.
- Provider refund/cancel reconciliation across all live providers.
- Enterprise pooled account contracts, SSO and SCIM.
