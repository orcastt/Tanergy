# Credit system — MVP rules

Status: **MVP / acceptance-ready** for issue [#3](https://github.com/orcastt/Tanergy/issues/3). This document is the canonical contract for the rules tested by `apps/web/e2e/credits/*.spec.ts`.

## Who holds credits

Each `tangent_credit_accounts` row is owned by exactly one of:

- **Personal wallet** (`owner_type=user`, `account_kind=personal_wallet`) — created on user registration. Charged by AI runs inside Solo / Group / Collaborate workspaces.
- **Team wallet** (`owner_type=workspace`, `account_kind=team_wallet`) — created on Team workspace creation. Charged by AI runs inside Team workspaces, regardless of which seat triggered the run.

`workspace_entitlements.resolve_ai_charge_summary(context)` is the single source of truth for "which account does THIS run charge". Don't bypass it.

## When credits are spent

Per **AI run** (image generation, image analysis, text completion). One run = one preflight + one settle. Credits are not charged per canvas edit, per board op, or per page operation.

Lifecycle:

1. **Quote** — `POST /api/v1/ai/runs/quote` returns the estimated credit cost. No ledger write.
2. **Preflight** — `POST /api/v1/ai/runs` and `GET /api/v1/credits/preflight` both call `build_credit_preflight_for_account`. If `available_credits < required_credits`, the run is rejected with HTTP 402 before any provider call.
3. **Settle** — when `finalize_mock_run` returns `status='succeeded'`, `settle_usage_charge_to_account` writes a `usage_charge` ledger row with `credits_delta = -cost`.

## Failure & refund semantics

**Provider failure (during execution):** zero charge.
- `ai_run_execution.finalize_mock_run` short-circuits before any `settle_usage_charge_to_account` call when `execution.status != 'succeeded'`. No ledger row is written. The run record is persisted with `status='failed'` and `cost_credits` unset.
- Provider-side cost (if any) is still recorded in `api_cost_ledger` for internal accounting, but never billed to the user.

**Cancellation (after charge already happened):** refund.
- `cancel_mock_run` calls `refund_outstanding_run_charge(context, run_id)` after persisting the canceled record.
- The helper queries the ledger for all rows with `source_id=run_id, source_type='ai_run'`, sums `credits_delta`, and emits a single `usage_refund` row equal to the absolute outstanding debt.
- **Idempotent.** Calling cancel twice never produces two refunds. The race where `finalize_mock_run` settles a charge after `cancel_mock_run` has already returned is closed by a second refund call inside the executor's canceled-detection branch in `_execute_scheduled_run`.

**Cancellation (before charge):** no ledger activity. Refund helper sees zero outstanding debt and returns `None`.

## Subscription, top-up, and admin flows (out of scope for #3 acceptance)

- **`subscription_grant`** — written by checkout webhook after a plan purchase / renewal. Cycle-scoped (refresh every 30 days). Unused included credits do not carry forward.
- **`topup_purchase`** — written by checkout webhook for à-la-carte credit packs. Persists across cycles and across plan upgrades.
- **`admin_adjustment`** — written by admin finance console for manual corrections. Always writes an audit-trail row, never bypasses the ledger.

## UI surfaces

- **`/usage`** — `BillingWorkspaceUsageView` renders per-workspace balance (used / total, top-up balance, next refresh date) and a recent-activity table with one row per ledger entry. Each row shows date, scope, action label (`formatLedgerAction`), and credit delta.
- **Admin** — `/admin/finance/credit-ledger` exposes full ledger reads filtered by workspace and reason, plus manual-adjustment write paths.

## Ledger reason vocabulary

The set lives in `services/api/tangent_api/credit_ledger_support.py:LEDGER_REASONS`:

| reason | sign of `credits_delta` | source_type | written by |
| --- | --- | --- | --- |
| `subscription_grant` | positive | `subscription` | checkout webhook |
| `topup_purchase` | positive | `payment` | checkout webhook |
| `usage_charge` | negative | `ai_run` | `settle_usage_charge_to_account` (after successful run) |
| `usage_refund` | positive | `ai_run` | `refund_outstanding_run_charge` (on cancel after charge) |
| `admin_adjustment` | either | `admin` | admin finance console |
| `plan_change_adjustment` | either | `subscription` | plan upgrade/downgrade delta |
| `seat_change_adjustment` | either | `subscription` | Team seat-count change |

## Out of scope for #3

The following are **deferred** and not gated by this MVP acceptance test:

- Stripe live integration (currently `manual_test` + generic hosted checkout)
- Invoice generation, tax calculation, automated refund processing
- Subscription renewal automation against live providers
- Deep provider-reconciliation against `api_cost_ledger` for billing dispute resolution
- Enterprise pooled wallets / cross-team credit transfer

See `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` and `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` for the post-MVP roadmap.

## Tests that gate this contract

Run via `npm run test:e2e:web` from repo root:

- `apps/web/e2e/credits/credit-happy-path.spec.ts` — successful run deducts credits + writes one `usage_charge` row
- `apps/web/e2e/credits/credit-failure-no-charge.spec.ts` — failed provider response leaves the ledger untouched
- `apps/web/e2e/credits/credit-cancel-refund.spec.ts` — cancel after charge emits a matching `usage_refund` (idempotent on retry)
- `apps/web/e2e/credits/credit-insufficient-balance.spec.ts` — preflight rejects when balance is short; no ledger write
- `apps/web/e2e/credits/credit-usage-ui.spec.ts` — `/usage` page shows remaining credits + activity table covering each row type

Backend unit/contract tests for the same surface live alongside the helpers in `services/api/tangent_api/` (see existing `*test*.py` files for `settle_*` and `build_credit_*` coverage).
