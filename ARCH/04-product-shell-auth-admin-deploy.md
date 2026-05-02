# Product Shell / Auth / Admin / Deploy Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.1, 4.11, 5.2, 5.9-5.13, 11.6-11.7

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

Landing page does not appear in the left sidebar. Account and Settings remain sidebar/footer semantic entries.

## Current Product Semantics

Do not pretend these are production-complete:

- Landing page: orientation shell only.
- Login/Register: visual shell and local validation only.
- Team: placeholder, no real invitations or membership changes.
- Billing/Subscription: placeholder, no Stripe or credit granting.
- Account: mock profile/session boundary.
- Settings: app/canvas/server-boundary settings, not Admin or Stripe.

## Auth Boundary

Current status:

- Mock/dev session endpoint exists.
- Request context carries dev user/workspace ids.
- `x-tangent-user-id` / `x-tangent-workspace-id` are development context only.
- Real email/session/JWT is pending.
- Optional dev guard shapes exist; production Auth is not complete.

Production rule:

- Frontend headers are not authority.
- FastAPI must resolve user/workspace from trusted session/token.
- `/workspaces` and `/boards/:boardId` must be protected before Alpha.
- All Board/Asset/AI/Admin API must scope by current user/workspace.

Target user fields:

- `id`
- `email`
- `display_name`
- `avatar_url`
- `status`
- `created_at`
- `last_login_at`

Admin role must not be a simple public user profile field.

## Admin S0 Boundary

Admin is planning/scaffold only until real Auth exists.

Do not build a fake Mixpanel dashboard from frontend state. Future admin facts must come from server-side tables:

- `admin_roles`
- `admin_audit_logs`
- `admin_user_notes`
- `board_members`
- `credit_ledger`
- `subscriptions`
- `payments`
- `invoices`
- `ai_api_calls`
- `analytics_events`
- `moderation_items`

Admin roles:

```text
owner | admin | support | analyst | finance | moderator
```

Admin S0 recommended delivery:

- schema/migration for admin roles, audit logs and user notes.
- service-side admin access boundary.
- `/admin` shell that is hidden from non-admin users.
- `/admin/users` MVP only after real server-side role check.
- all sensitive admin writes create `admin_audit_logs`.

Until real Auth exists, production `/admin` must not be open.

## Workspace / Board Membership

Workspace and Board roles are separate facts.

Target `workspace_members`:

- `workspace_id`
- `user_id`
- `role`: `owner` / `admin` / `member` / `guest`
- `invited_by`
- `joined_at`
- `removed_at`

Target `board_members`:

- `board_id`
- `user_id`
- `role`: `owner` / `editor` / `viewer` / `temporary_viewer`
- `invited_by`
- `joined_at`
- `expires_at`
- `last_seen_at`

Rules:

- Board owner/editor/viewer is a Board-level fact source.
- Workspace admin may manage but does not automatically become Board owner.
- Temporary viewers require `expires_at`.
- Presence does not live in these tables.

## Credits / Billing / Revenue Facts

Target fact sources:

- `credit_accounts`
- `credit_ledger`
- `subscriptions`
- `payments`
- `invoices`

Revenue dashboard metrics such as MRR, ARR, churn, ARPU and LTV must come from these tables or aggregate snapshots, not from UI assumptions.

AI provider costs must be tied to `ai_runs`, `ai_api_calls` and cost ledger facts.

## Analytics / Moderation Facts

Target analytics event:

- `user_id`
- `anonymous_id`
- `workspace_id`
- `board_id`
- `event_name`
- `screen`
- `properties`
- `created_at`

Target moderation queue:

- Asset / Board / Prompt / user report targets.
- queued/reviewing/approved/rejected/escalated statuses.
- admin moderation actions with reason and audit trail.

Full funnel/cohort dashboards are later slices. The immediate rule is to avoid losing the facts needed to build them.

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
local edit
  -> quality gates
  -> commit
  -> push
  -> staging deploy
  -> smoke
  -> production promote
```

Do not directly edit code on the server.

## Staging Smoke Checklist

- `/health` returns 200.
- CORS preflight from Web origin returns allow-origin.
- Upload PNG/JPEG/WebP: object exists and metadata exists.
- `/workspaces` lists Board summary.
- `/boards/:boardId` saves, refreshes and loads.
- Board guard rejects `data:` / `blob:` / base64 payload.
- Board History create/list/load works.
- AI provider slice, once added, creates an Asset and AiRun log.

## External Resource Order

1. Git remote and deploy key/CI token.
2. Staging domain: `staging.<domain>` and `api-staging.<domain>`.
3. Managed Postgres with backup policy.
4. R2/S3 bucket with CORS.
5. API deploy target.
6. Web deploy target and `NEXT_PUBLIC_API_BASE_URL`.
7. Email provider and SPF/DKIM/DMARC.
8. AI provider key and budget controls.
9. tldraw production license.
10. Monitoring/logging and backup restore drill.
