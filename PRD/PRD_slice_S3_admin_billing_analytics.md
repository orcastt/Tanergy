# PRD Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-02
**Mode**: Architecture slice.

## Goal

Prepare the factual data sources and access boundary for a future management panel without building a fake Mixpanel-grade dashboard before Auth, billing and AI runs exist.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Admin access | Admin entry is visible only to users with server-side admin role. | Planned |
| Users | Admin can search users, view profile, status, role, workspace, boards and notes. | Planned |
| Audit | Every admin write action creates an audit log. | Planned |
| Credits | Credit account and ledger record grants, usage, refunds and admin adjustments. | Planned |
| Billing | Subscription/payment/invoice facts are queryable for revenue views. | Planned |
| AI API calls | Admin can inspect model/provider/latency/status/cost/error by user/run. | Planned |
| Analytics | Event facts support funnels, retention cohorts and activation metrics. | Planned |
| Moderation | Assets/prompts/reports can enter review queues later. | Planned |

## Acceptance

- Admin permissions are checked server-side through `admin_roles`.
- Frontend role flags are not authority.
- All admin writes write `admin_audit_logs`.
- Production `/admin` is not exposed before real Auth exists.

## Non-Goals

- No full revenue dashboard before subscriptions/payments exist.
- No production impersonation before audit and permission rules are complete.
- No moderation UI before moderation facts exist.
