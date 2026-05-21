# PRD Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-20
**Status**: In progress; staging Web/API/Supabase Pro/R2 smoke, the Konva-only redeploy, Cloudflare-proxied Full (strict) staging domains and real Clerk session/admin smoke are back in place. Neon is now historical after its data-transfer quota pause, the temporary Hetzner `staging-postgres` fallback and volume have been removed, R2 staging objects were cleared for a clean asset lane, and board realtime persistence now keeps process updates in the WebSocket room while persisting only compacted/final snapshots by default. The deployment/ops readiness pass now has separate Web/API env templates, public SSL/header smoke, API slow-response/RSS observability hooks and an ops acceptance report; after the 2026-05-20 `b35adc0` redeploy the public ops smoke is fully green for Web/API TLS, Web headers, static cache, API `/health` headers and CORS. Production remains blocked until external uptime monitoring, status page, backup/PITR drill, WAF/rate-limit dashboard confirmation and error tracking/APM are configured and tested. The second-round signed-in board/browser pass is mostly green, and the `Manage board -> Copy board` Free-plan limit modal path is wired locally across gallery/dashboard/manage-panel copy entrypoints; the remaining product gates are R2 clean asset smoke, re-created minimal staging data, staging spot check for that modal path, Google/email flow verification and live GeekAI AI smoke before production can open.

## User Value

The app becomes testable outside local dev. Real browsers can access staging Web, save Boards through staging API, upload assets to object storage and receive login emails.

## Requirements

- Staging Web deployed on Vercel.
- FastAPI deployed on a public HTTPS API host.
- Managed Postgres connected through `DATABASE_URL`.
- Supabase Pro is the staging database truth; do not reintroduce Hetzner server-local Postgres for staging.
- Cloudflare R2 bucket connected through S3-compatible config.
- DNS/TLS configured for Web and API.
- Staging Web/API public records stay behind Cloudflare proxying with strict origin validation.
- Email provider domain verified for Auth emails.
- Auth provider staging project configured.
- Google OAuth enabled for staging login.
- Production Google OAuth preparation documented before public launch.
- Production deployment docs and API env template prepared before opening the public site.
- Staging and production Web env templates prepared separately; secrets stay only in Vercel/server/provider secret stores.
- Public deployment readiness must be smoke-tested for HTTPS certificates, security headers, API health and CORS before staging sign-off.
- Production launch requires external uptime monitoring, alert routing, status page, error tracking, performance dashboards and a documented backup/PITR restore drill.
- Konva-only Board route redeployed, with legacy Board documents blocked in the active app path.
- Staging deploys must not depend on an old mutable repo clone for live secrets; the current release receives `deploy/staging/api.env` from private operator storage or a server-local shared secret store.
- Collaboration process updates must not be treated as database writes; Postgres stores compacted/final realtime document snapshots unless `TANGENT_BOARD_REALTIME_PERSIST_MODE=update_chain` is explicitly used as a rollback mode.

## Online Preparation Checklist

Beginner runbook:

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

- Buy or connect domain and use Cloudflare DNS.
- Create Vercel project and connect GitHub.
- Create API VPS or PaaS app for FastAPI.
- Create managed Postgres project.
- Create R2 bucket and bucket-scoped credentials.
- Create email provider account and verify SPF/DKIM/DMARC.
- Create Clerk project.
- Enable Google social login in the Auth provider.
- Configure staging and local redirect URLs.
- Prepare Google Cloud OAuth Client ID/Secret for production domain before launch.
- Add staging environment variables.
- Keep production and staging secrets separate.

## Acceptance

- `https://api-staging.../health` returns 200.
- Vercel staging Web calls FastAPI with CORS allowed.
- Postgres migrations run.
- Fresh Supabase Pro staging database reaches Alembic head.
- Asset upload/read works.
- Board save/load/history works against staging.
- Board realtime process updates broadcast through WebSocket without writing every `yjs-update` to Postgres.
- Existing real Clerk login/logout/session works on staging and admin-backed probes return green.
- Signed-in browser acceptance covers Board create/open/save/delete and paste/upload persistence through reload/history/thumbnail flows.
- Email OTP can be delivered to a test inbox.
- Google login succeeds on staging.
- FastAPI accepts valid provider JWT and rejects invalid/expired JWT.
- `/boards/[boardId]` opens Konva v2 on staging without any legacy paid-canvas runtime path.
- Retiring an old staging worktree does not remove the live API env or break the active release.
- Production launch has separate database, storage, auth and payment secrets from staging.
- Deployment readiness report exists in `docs/ops-readiness-acceptance.md`.
- Public staging Web/API domains pass the ops readiness smoke, or any failure is recorded as an explicit external-infra blocker.
- Signed-in admin, workspace settings and workspace invite mutations must work from the staging browser without disabling FastAPI CSRF/Origin checks; same-origin Next proxies may forward Bearer auth and trusted origin for these restricted route families.
- Board names must reject symbol-heavy/scripting-prone characters consistently in the canvas title, workspace cards, local bridge and FastAPI persistence.
- Incident response runbook exists before production opens.

## 2026-05-20 Stage Comparison

| Area | Previous stage | Current stage |
| --- | --- | --- |
| Public deploy smoke | TLS, static cache and CORS passed, but Web home/API `/health` missed required security headers. | `ops_readiness_smoke.py` is fully green for Web/API TLS, Web headers, static cache, API `/health` and CORS. |
| API release | The first GeekAI deploy reached the server but Alembic `20260520_0033` initially failed on pricing-rule FK order, and the first restart check showed the older container image was still running. | API release `b35adc0` is recreated and healthy; Alembic is `20260520_0033 (head)`. |
| Security behavior | API `/health` returned 200 but did not set `Cache-Control`. | API `/health` returns 200 with `Cache-Control: no-store` and the standard security headers. |
| AI route posture | Jiekou remained available as historical fallback material and the active staging defaults were mid-transition. | Active staging control-plane routes are GeekAI-first for text, analysis and image; QwQ and GPT Image 2 are the default text/image models. |
