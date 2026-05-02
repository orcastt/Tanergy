# Product Shell / Auth / Admin / Deploy Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 1, 4, 5, 8, 10, 11

## Product Shell

Current local routes:

- `/home`: landing/orientation shell, top nav only.
- `/workspaces`: active workspace Board gallery/list.
- `/collections`: future Asset/reference library placeholder.
- `/account`: mock account center.
- `/settings`: app/canvas/server-boundary settings shell.
- `/team`: team placeholder.
- `/billing`: subscription placeholder.
- `/login`, `/signup`, `/forgot-password`, `/verify-email`: split-screen mock Auth surfaces.
- `/boards/:boardId`: Board canvas.

Top navigation is:

```text
Landing page / Workspace / Collection / Team / Subscription
```

Landing page does not appear in the left sidebar.

## Auth Boundary

Current status:

- Mock/dev session endpoint exists.
- Request context carries dev user/workspace ids.
- Real email/session/JWT is pending.

Production rule:

- Frontend headers are not authority.
- FastAPI must resolve user/workspace from trusted session/token.
- `/workspaces` and `/boards/:boardId` must be protected before Alpha.

## Admin S0 Boundary

Admin is planning/scaffold only until real Auth exists.

Future admin facts must come from server-side tables:

- `admin_roles`
- `admin_audit_logs`
- `admin_user_notes`
- `board_members`
- `credit_ledger`
- `subscriptions/payments/invoices`
- `ai_api_calls`
- `analytics_events`
- `moderation_items`

Do not build a fake Mixpanel dashboard from frontend state.

## Deploy Boundary

Staging resources still needed:

- API server or VPS/container host.
- Managed Postgres.
- R2/S3-compatible bucket.
- Staging domain + TLS.
- CORS allowlist.
- Email provider and sender domain.
- AI provider key and budget controls.
- tldraw production license domain.

Default deploy flow:

```text
local edit -> quality gates -> commit -> push -> staging deploy -> smoke -> production promote
```
