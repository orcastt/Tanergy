# ARCH Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-05
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
- Minimal backend access probe exists: `GET /api/v1/admin/me` loads active `admin_roles` for the authenticated local user id.
- No production admin panel yet.
- No real billing, analytics events, moderation queue or impersonation.

## First Admin MVP Boundary

```text
Auth session
  -> server checks admin_roles
  -> read-only user/workspace/board/asset/AiRun/API-call views
  -> any write action must create admin_audit_logs first
```

Do not expose `/admin` in production until real Auth and server-side `admin_roles` are active.

Current bootstrap-first implementation direction:

- Keep `/api/v1/admin/me` read-only and narrow.
- Use it to decide whether a future `/admin` page should render or redirect.
- Delay admin role grant/revoke APIs until an audit-log helper and existing owner/admin guard are in place.

## Admin Bootstrap Contract

The first global admin must be granted server-side after real Auth maps a verified provider identity into `tangent_users`.

```text
Clerk verified user
  -> S1C auth/session mapping
  -> tangent_users row
  -> one-time server/DB bootstrap grants tangent_admin_roles.owner
  -> bootstrap writes tangent_admin_audit_logs
```

Rules:

- Workspace `owner/admin` is not global Admin.
- Frontend flags, environment variables and browser-provided role fields are never Admin authority.
- `tangent_admin_roles` is the only global Admin authority.
- Every Admin write route must insert `tangent_admin_audit_logs` in the same server-controlled operation.
- The first bootstrap may be manual SQL or a one-time CLI, but it must target an existing verified local user id and create an audit record.
- Later role grants/revokes must happen through server routes that check an existing active `owner/admin` role.

Role meaning:

```text
owner      Full global administration; bootstrap and dangerous settings.
admin      General user/content/system admin after owner exists.
support    User and workspace support views with narrow write actions.
analyst    Read-only analytics, AI run and cost views.
finance    Billing, subscription and credit-ledger operations.
moderator  Moderation queues, content actions and abuse workflows.
```
