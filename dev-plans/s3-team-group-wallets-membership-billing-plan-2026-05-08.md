# S3 Team/Group Wallets, Membership And Billing Plan

**Created**: 2026-05-08
**Status**: Active tactical plan.
**Owner slice**: S3, with S1A/S1C/S1D/S2 dependencies.

## Purpose

Implement the new commercial model without letting Team billing, Group collaboration, Auth, Board permission and AiRun charging drift apart.

Core rule:

- Team Start/Growth uses a Team wallet owned by the Team workspace.
- Collaborate Start/Plus uses the paying user's personal wallet.
- A user may own multiple Teams.
- A user may have only one active Collaborate subscription: Start or Plus.

## Current Reusable Foundation

- Workspace/member/Board schema and permission scaffolds exist.
- `credit_accounts`, `credit_ledger`, subscriptions, payments and invoices scaffolds exist.
- Team seat assignment and member-role mutation routes have a first pass.
- `/billing`, `/team`, `/usage` and `/admin` surfaces exist.
- AiRun quote/preflight/lifecycle, route/pricing facts and provider-cost facts exist.

## Phase 0: Contract Lock

- Rename the active product contract from "Team seat-backed personal credits" to "Team wallet".
- Confirm plan keys and included-credit targets:
  - `collaborate_start`
  - `collaborate_plus`
  - `team_start`
  - `team_growth`
- Define exact seat capacity rules: initial seats, min seats, max seats, add-seat behavior and downgrade behavior.
- Define whether Group count is limited by Collaborate tier. Do not block the wallet/payer work on this if not decided.

Exit criteria:

- PRD/ARCH/project_state agree on payer ownership.
- No active docs describe Team Start/Growth as actor-personal seat-backed payer; the old 2026-05-06 S3 strategy remains only as a superseded benchmark reference.

## Phase 1: Database Delta

Add or confirm:

- [x] `credit_accounts.account_kind = personal_wallet | team_wallet | enterprise_pool` or equivalent constrained metadata.
- [x] `subscriptions.plan_family = free | collaborate | team | enterprise`.
- [x] `subscriptions.seat_capacity`, owner fields, workspace link and period columns.
- [x] Unique active Collaborate subscription constraint per user.
- [x] Unique active Team subscription constraint per workspace.
- [x] Team purchase linkage from subscription/payment to workspace and Team wallet. Initial `/billing/teams/checkout` plus payment completion now provisions Team workspace, owner membership, Team wallet, subscription, seat capacity and first included-credit grant.
- [x] Workspace invite token fields: token hash, role, expiry, revoked/accepted timestamps, inviter, optional target user/email.
- Seat assignment facts scoped to Team workspace and member, without implying a personal credit account.
- [x] `ai_runs.node_id` confirmed from the base schema; `team_wallet` charge-scope compatibility added.

Tests:

- [x] Migration contract test for new columns/constraints.
- [x] Empty DB and seeded DB migration smoke against disposable Postgres after this cut.
- [x] Static unique active Collaborate constraint coverage in migration contract test.

## Phase 2: Auth, Registration And Workspace Selection

- Ensure first verified user session creates:
  - local user
  - default solo workspace
  - personal wallet
- Add active workspace selection that cannot be spoofed by frontend headers.
- [x] Add Team checkout completion flow that creates a Team workspace and owner membership.
- [x] Add Collaborate checkout completion flow that activates exactly one personal Collaborate subscription.

Tests:

- New user gets personal wallet and default workspace.
- [x] User can own multiple Team workspaces.
- [x] User cannot activate both Collaborate Start and Plus.
- Workspace selection rejects non-member workspace ids.

## Phase 3: Team And Group Membership

Team:

- [x] Create Team invite link/email invite backend contract.
- [x] Accept Team invite with role admin/editor/viewer backend contract.
- [x] Enforce seat capacity for Team invite accept backend contract.
- [x] Remove member and revoke member seat assignment backend contract.
- Team owner/admin can update roles.

Group:

- [x] Create Group workspace under personal Collaborate authority.
- [x] Create/accept Group invite backend contract.
- Group admin/editor/viewer roles manage collaboration structure only.
- Group admin cannot see other members' billing or personal usage.

Tests:

- [x] Invite accept creates correct workspace membership.
- [x] Revoked/expired invite cannot be accepted.
- [x] Team member removal stops future Team wallet usage by that member.
- Group admin billing visibility is denied for another user.

## Phase 4: Wallet And Billing Services

- [x] Team wallet balance, ledger and top-up checkout backend contract.
- [x] Team seat add checkout and included-credit grant into Team wallet.
- [x] Personal wallet balance, ledger and top-up checkout.
- [x] Collaborate subscription grant into personal wallet.
- Billing usage summaries:
  - personal usage
  - Team total usage
  - Team member usage
  - Team Board/model usage

Tests:

- [x] Team top-up credits workspace-owned account.
- [x] Personal top-up credits user-owned account.
- [x] Team seat add grants to Team wallet.
- Credit ledger balances derive from ledger entries.

## Phase 5: Payer Resolver And AiRun Integration

Server-side payer resolver:

```text
solo/free            -> actor personal wallet
group/collaborate   -> actor personal wallet
team                -> active Team wallet
enterprise          -> contract-defined workspace pool or personal fallback
```

Implementation:

- Quote endpoint returns payer summary and shortfall before provider execution.
- Run create stores actor, workspace, board, node, model, tier, route, pricing rule and charged account.
- Run create rejects when actor lacks Board permission, workspace membership, payer eligibility or balance.
- Settlement writes `usage_charge`, `usage_refund` and provider-cost facts against the originally resolved account.

Tests:

- [x] Group run charges actor personal wallet.
- [x] Team run charges Team wallet.
- [x] Later polling/cancel cannot switch charged account.
- [x] Insufficient balance fails before provider call.

## Phase 6: UI And Admin Surfaces

User UI:

- [x] Team create/purchase flow first-pass UI using manual-test checkout/complete or hosted checkout redirect.
- [x] Team member invite, remove, role update, seat assignment and seat count first-pass UI with owner/admin gating. Add-seat polish and board-specific assignment remain.
- [x] Team wallet top-up and seat checkout buttons from `/usage` call real billing routes; hosted checkout return pages exist.
- [x] Group create/invite/member remove/role-update first-pass UI.
- [x] Personal wallet top-up from `/usage` calls real billing route.
- Clear AI node payer hints.

Admin/developer UI:

- [x] Filter AiRuns by user, workspace/team, board, node, product model, route, pricing rule and charged account.
- [x] Inspect Team wallet ledger and personal wallet ledger through admin finance read APIs and frontend panels.
- [x] Inspect subscription, seat capacity, wallet balance, payment facts and Team member usage through admin finance panels.
- [x] Manual admin billing bridge for Stripe-unavailable operations: user wallet top-up/deduction, Team wallet top-up/deduction, Collaborate/Group plan assignment, Team plan assignment, Team/Group creation, subscription cancellation and workspace deletion, all audited through `/admin` finance controls.
- [x] Manual admin writes require an operation reason and use `effectMode` plus `durationCount * durationUnitDays` for plan windows instead of date-picker expiry edits.
- [x] Split `/admin` into Overview, Users, Teams, Groups, AI API Routes, Finance and Access tabs backed by admin directory APIs and AI route metrics.
- [ ] Rebuild admin operator console around the new inventory/detail mock: fast User inventory, one-call user detail bundle, Billing / Team Plan / Joined Team / Group Plan / Joined Group tabs, modal operations and no helper-copy UI. Detailed checklist lives in `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md`.
- Keep route/pricing publish/rollback audited.

Tests/smoke:

- [x] Minimal Team purchase -> invite -> quote -> member removal -> run settlement smoke against disposable Postgres.
- [x] Minimal Group create/invite -> quote -> personal-wallet run settlement smoke against disposable Postgres.
- [x] Local `/admin` finance UI smoke against disposable Postgres-backed API; payment, wallet, subscription, ledger and member usage reads returned 200.
- [x] Local manual/hosted payment smoke: manual Team wallet top-up, manual Team seat checkout + assignment, hosted redirect URL and hosted manual-complete 409.
- [x] Local live API smoke: `/api/v1/admin/directory/users`, `/api/v1/admin/directory/workspaces` and `/api/v1/admin/ai/route-metrics` returned 200 from `127.0.0.1:8100`; `/admin` returned 200 with the dev-bypass cookie.
- Admin can explain each smoke run.

## Phase 7: Payment, Renewal And Finance Depth

- [x] Payment webhook inbox first cut: signed provider event endpoint records `tangent_webhook_events`, completes checkout payments by internal payment id, client reference or provider metadata checkout session id through the shared completion path, and treats duplicate provider events as idempotent.
- [x] Hosted checkout response contract first cut: checkout responses include provider session metadata, amount/currency/kind/client-reference handoff metadata, non-manual providers require hosted checkout configuration before payment creation, and hosted-provider payments cannot be manually completed.
- [x] Provider-neutral checkout adapter first cut: `manual_test` and generic hosted checkout keep staging moving; optional `stripe` provider requires `TANGENT_STRIPE_SECRET_KEY` only when selected, creates Checkout Sessions through Stripe's server API, labels `checkout.adapter=stripe_checkout`, and keeps secrets server-side.
- [x] Admin finance reconciliation first pass: server-gated summary/payment/wallet/subscription/credit-ledger/member-usage reads, frontend panels and audit events.
- [x] Manual admin operations first pass: audited `admin_manual` top-up, credit adjustment, plan assignment, subscription cancellation and workspace deletion write payment, subscription, credit ledger and audit facts while Stripe is unavailable.
- Payment provider webhooks become production authority for grants and subscription state after deployed staging smoke and provider-specific signatures are wired.
- Renewal grants monthly included credits.
- Cancellation/downgrade handles remaining credits and seat capacity.
- Invoice, refund and revenue reconciliation views land in Admin finance.
- Refund/cancel policy reconciles `credit_ledger` and `api_cost_ledger`.

This phase can start after Phase 5 smoke is stable.

## Cutover Risks

- Team wallet pivot can silently conflict with old actor-personal resolver. Add tests before live provider charging.
- Seat assignment must not create payer accounts by accident.
- Group admin UX must not leak personal wallet data.
- Fast local GeekAI routes must not bypass server payer resolution in production.
- Payment completion and webhook handlers must be idempotent.

## Recommended Next Implementation Order

1. Phase 1 schema delta.
2. Phase 2 user personal wallet and Team checkout creation flow.
3. Phase 5 payer resolver tests in mock mode.
4. Phase 3 invite/member hardening.
5. Phase 4 wallet/top-up/seat grants.
6. Phase 6 UI/admin surfaces.
7. Phase 7 payment automation.
