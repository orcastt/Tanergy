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

- [x] Team create/purchase flow first-pass UI using manual-test checkout/complete.
- [x] Team member invite, remove and seat count first-pass UI. Rich role editing and add-seat polish remain.
- Team wallet balance, top-up and usage view.
- [x] Group create/invite/member management first-pass UI.
- Personal wallet/billing/usage view.
- Clear AI node payer hints.

Admin/developer UI:

- Filter AiRuns by user, workspace/team, board, node, product model, route, pricing rule and charged account.
- Inspect Team wallet ledger and personal wallet ledger.
- Inspect subscription, seat capacity and payment facts.
- Keep route/pricing publish/rollback audited.

Tests/smoke:

- [x] Minimal Team purchase -> invite -> quote -> member removal -> run settlement smoke against disposable Postgres.
- [x] Minimal Group create/invite -> quote -> personal-wallet run settlement smoke against disposable Postgres.
- Admin can explain each smoke run.

## Phase 7: Payment, Renewal And Finance Depth

- [x] Payment webhook inbox first cut: signed provider event endpoint records `tangent_webhook_events`, completes checkout payments through the shared completion path, and treats duplicate provider events as idempotent.
- Payment provider webhooks become production authority for grants and subscription state after real provider signature/session mapping is wired.
- Renewal grants monthly included credits.
- Cancellation/downgrade handles remaining credits and seat capacity.
- Invoice and reconciliation views land in Admin finance.
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
