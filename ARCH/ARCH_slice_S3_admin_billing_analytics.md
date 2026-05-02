# ARCH Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-02
**Mode**: Architecture slice.

## Scope

Data-model and access boundary for future management panel, billing and analytics.

## Fact Sources

```text
admin_roles
admin_audit_logs
admin_user_notes

credit_accounts
credit_ledger
subscriptions
payments
invoices

model_registry
model_provider_routes
ai_runs
ai_api_calls
api_cost_ledger

analytics_events
analytics_funnel_snapshots
analytics_cohort_snapshots

moderation_items
moderation_actions
```

## Permission Rules

- `/admin` is production-disabled until real Auth exists.
- Admin access is checked server-side through `admin_roles`.
- Every admin write writes `admin_audit_logs`.
- Support, analyst, finance and moderator roles must be separable.

## Current State

- Boundary is documented.
- No production admin panel yet.
- No real billing, analytics events, moderation queue or impersonation.
