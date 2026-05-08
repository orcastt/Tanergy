# Project State Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-08
**Status**: Active pivot slice. Admin, ledger, usage, seat, checkout and AI-control-plane scaffolds exist, but the commercial rule changed: Team AI spend should charge a Team wallet, while Group/Collaborate AI spend stays personal.

## Current Truth

Reusable first-pass work:

- `/admin` is server-gated, reads summary/users/workspaces/boards/audit facts and supports audited owner-only admin role changes.
- `/admin` AI panels can inspect/edit model, provider-route and pricing facts, with versioned publish/rollback.
- `/billing`, `/team` and `/usage` first-pass screens exist.
- Backend billing/entitlement reads exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Team seat list/upsert/revoke and workspace member-role mutation exist for the current workspace.
- `credit_accounts`, `credit_ledger`, preflight reads and internal grant/top-up/usage/refund/admin-adjustment helpers exist.
- Payment checkout/complete scaffolds exist for top-ups and seat capacity, but real provider webhooks and reconciliation are not production-complete.
- AiRun quote/preflight/lifecycle, model-route-pricing facts, provider-cost facts and attempt-level admin runtime views exist.
- The canvas GeekAI fast path proves UX for image generation/edit/reference, analysis, chat and prompt optimization, but is not yet the production control-plane path.

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

1. Payer resolver: Team workspace runs must resolve to a workspace-owned Team wallet.
2. Subscription model: Team subscriptions must be workspace-owned; Collaborate subscriptions must be user-owned and single-active per user.
3. Seat lifecycle: seat capacity/member assignment must not imply per-member credit ownership.
4. Wallet grants: Team plan grants and top-ups write to the Team wallet; Collaborate grants/top-ups write to personal wallet.
5. Workspace purchase flow: Team checkout completion creates workspace, owner membership, wallet, subscription and initial seat capacity.
6. Invite acceptance: Team/Group invite links need product-grade accept/revoke/expiry and role assignment.
7. Permission services: Board roles, workspace roles, Team billing visibility and AI payer eligibility must stay separate.
8. Admin monitoring: every production AiRun must be queryable by user, team/workspace, board, node, model, route, pricing rule, charged account and provider cost.
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

- A new Team checkout can create an isolated Team workspace and Team wallet in staging/dev.
- A Team owner can invite a member, assign role, remove member and add seats.
- A Team AI quote resolves `charged_account_id` to the Team wallet.
- A Group AI quote resolves `charged_account_id` to the actor's personal wallet.
- A user cannot activate both Collaborate Start and Collaborate Plus at the same time.
- Admin runtime views can filter a run by user, workspace/team, board, model, route and charged account.

## Not Production-Complete

- Real payment webhooks, invoices and reconciliation.
- Subscription renewal/cancellation automation.
- Production-grade seat proration and downgrade policy.
- Full admin finance views.
- Provider refund/cancel reconciliation across all live providers.
- Enterprise pooled account contracts, SSO and SCIM.
