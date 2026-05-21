# ARCH Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-20
**Mode**: Architecture slice.
**Status**: In progress; rebuilt staging Web/API smoke is green again, Supabase Pro staging is now the database truth, the old Hetzner `staging-postgres` fallback and volume have been removed, R2 was cleared for a clean asset smoke lane, and board realtime persistence now keeps process updates in WebSocket room memory while writing only compacted/final snapshots to Postgres by default. The deployment/ops readiness layer now includes separate Web/API env templates, public TLS/header/CORS smoke, API slow-response/RSS log hooks and an ops acceptance artifact. The 2026-05-20 `b35adc0` redeploy made the public ops smoke fully green: Web/API TLS, Web headers, static cache, API `/health` headers and CORS all pass. Production still requires external uptime monitors, status page, backup/PITR proof, WAF/rate-limit dashboard confirmation and an error-tracking/APM provider before public launch. The second-round signed-in board/browser pass is mostly green, and the `Manage board -> Copy board` Free-plan modal path is wired locally across gallery/dashboard/manage-panel copy entrypoints; the remaining gates are R2 clean asset smoke, a staging spot check for that modal path, Google/email verification and one GeekAI live provider path under strict staging auth.

## Goal

Create a real staging environment where the Next.js web app calls a public FastAPI API over HTTPS, FastAPI uses managed Postgres plus R2/S3-compatible object storage, and DNS/TLS/secrets are configured in a repeatable way.

## Target Deployment

```text
Browser
  -> Vercel Web: staging.tangent...
  -> FastAPI API: api-staging.tangent...
      -> Supabase Pro Postgres
      -> Cloudflare R2
      -> Email provider
      -> Auth provider: Clerk
      -> Google OAuth production client
```

## Recommended P0 Staging Choices

- Frontend: Vercel project connected to GitHub, with `NEXT_PUBLIC_API_BASE_URL` pointing at staging FastAPI.
- Backend: Hetzner Cloud VPS in US West/Hillsboro if using a fixed-cost VPS, or another US region close to both Asia and Europe.
- Database: Supabase Pro managed Postgres for staging.
- Object storage: Cloudflare R2 bucket using S3-compatible credentials.
- DNS/domain: Cloudflare DNS. Register domain at Cloudflare Registrar or point existing registrar nameservers to Cloudflare.
- Email: Resend or similar transactional email provider for OTP/magic-link delivery.
- Auth provider: Clerk for P0 Google OAuth + Next.js UI; Supabase Auth is not part of this migration.
- Google OAuth: Auth provider development mode is acceptable locally, but production needs a Google Cloud OAuth client, verified domain, privacy policy URL and app branding.

## Purchase And Setup Checklist

Detailed beginner runbook:

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

1. Domain and DNS
   - Buy or transfer domain.
   - Put DNS under Cloudflare.
   - Reserve names:
     - `app.example.com` or `staging.example.com` for Vercel.
     - `api-staging.example.com` for FastAPI.
     - `assets.example.com` later if R2 public/custom domain is needed.

2. Vercel
   - Create team/project.
   - Connect GitHub repository.
   - Set environment variables:
     - `NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com`
   - Keep frontend server functions minimal; FastAPI remains API authority.

3. Hetzner or API host
   - Create Ubuntu VPS.
   - Add SSH key.
   - Install Docker and compose.
   - Configure firewall:
     - allow 22 from trusted IPs if possible
     - allow 80/443 public
     - block direct Postgres
   - Deploy FastAPI behind Caddy or Nginx with TLS.
   - Keep source-host ingress narrow after first boot:
     - `80/tcp` and `443/tcp` public
     - `22/tcp` limited to the maintainer's current fixed IP where possible
     - password login disabled after SSH key recovery

4. Managed Postgres
   - Create staging DB.
   - Store `DATABASE_URL` only in server secrets.
   - Run Alembic migrations.
   - Confirm connection pooling or pool limits.

5. Cloudflare R2
   - Create bucket, example `tangent-staging-assets`.
   - Create access key with bucket-scoped permissions.
   - Configure server env:
     - `S3_ENDPOINT`
     - `S3_ACCESS_KEY_ID`
     - `S3_SECRET_ACCESS_KEY`
     - `S3_BUCKET`
     - `S3_PUBLIC_BASE_URL`
   - Add cache rules/CDN strategy before public traffic grows.

6. Email provider
   - Verify sending domain.
   - Add SPF/DKIM/DMARC DNS records.
   - Configure API key in FastAPI.
   - Smoke test OTP email to real mailbox.

7. Auth provider and Google OAuth
   - Create Clerk project for staging.
   - Enable Email address login.
   - Enable Google social login.
   - Add frontend env:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or provider equivalent.
   - Add server-only env:
     - `CLERK_SECRET_KEY` or provider equivalent.
     - `AUTH_PROVIDER=clerk`.
     - JWT issuer, audience and JWKS URL.
   - Configure allowed redirect URLs:
     - `https://staging.example.com`
     - local dev URL if needed.
   - For production, create Google Cloud OAuth 2.0 Client ID.
   - Add production domain, logo, privacy policy and terms URLs to Google OAuth consent configuration.
   - Put Google Client ID/Secret into the Auth provider production config, not into public app env.

8. Secrets
   - Store secrets in Vercel and server environment only.
   - Never expose API keys in frontend code.
   - Rotate staging keys before production.

## Production Split

Production is now documented in:

```text
deploy/production/README.md
deploy/production/api.env.example
```

Recommended production boundary:

- separate Vercel project or at minimum separate production env/domain wiring
- separate API env file and compose stack
- separate Postgres database credentials, preferably a separate Supabase project/database
- separate R2 bucket and write credentials
- separate Clerk production keys and redirect/origin settings
- separate email and payment secrets

Promotion policy:

- staging remains the internal acceptance lane
- production opens only after staging real-login, email/OAuth, admin and live-AI smokes are green
- deploy the same reviewed commit SHA from staging to production

## Deployment And Ops Readiness

Operational readiness now has a repo-owned verification layer:

- Web env templates live in `deploy/staging/web.env.example` and `deploy/production/web.env.example`; API env templates remain split in the same deploy folders.
- `services/api/scripts/security_deploy_config_smoke.py` checks production-like API auth, Redis security counters, origin allowlists, Clerk verification, object storage and recommended observability env.
- `services/api/scripts/ops_readiness_smoke.py` checks public Web/API HTTPS certificates, security headers, Next static cache headers, API `/health` and CORS preflight.
- FastAPI middleware records slow API responses and high RSS warnings through `tangent_api.ops_observability` without logging query strings.
- The detailed acceptance matrix is `docs/ops-readiness-acceptance.md`.

External infrastructure still owns these production blockers:

- Cloudflare WAF, bot/rate-limit rules and SSL mode must be confirmed in the dashboard.
- Managed Postgres backups/PITR and one restore drill must be completed outside repo code.
- Uptime monitor, status page, alert channel, error tracking and APM dashboards must exist before public launch.

## 2026-05-20 Stage Comparison

| Boundary | Previous staging state | Current staging state |
| --- | --- | --- |
| Web deploy | Konva-only Web was online, but the public smoke still caught missing home-page security headers in the deployed release. | `https://staging.tanergy.cc` returns 200 and passes the Web security-header check. |
| API deploy | GeekAI API release was built, but Alembic `20260520_0033` initially failed because the QwQ model default referenced pricing before the pricing row existed; the first restart check also showed an old container image. | Release `b35adc0` is recreated, Docker health is green, `/health` is green locally and publicly, and Alembic reports `20260520_0033 (head)`. |
| Network security | TLS, CORS and static cache were green; `/health` still missed `Cache-Control`. | `ops_readiness_smoke.py` is fully green and `/health` now returns `Cache-Control: no-store` plus standard security headers. |
| Frontend/backend AI coordination | The provider switch was pushed but not yet verified against staging DB route facts. | Staging DB confirms enabled/healthy GeekAI routes for `qwq-plus-latest`, `qwen/qwen2.5-vl-72b-instruct`, `gpt-image-2`, `nano-banana-2` and `doubao-seedream-5.0-lite`; QwQ and GPT Image 2 are default text/image models. |
| Post-stage browser regressions | Browser mutations surfaced strict-Origin false negatives on admin/workspace writes, and Board titles still accepted symbol-heavy values in some UI/local paths. | Next admin proxy is Bearer-first and forwards same-origin `Origin`; workspace/dashboard/invite writes use a same-origin allowlisted workspace proxy; Board title policy is strict across frontend, local bridge and FastAPI. |

## Official References

- Vercel pricing/docs: https://vercel.com/pricing
- Cloudflare R2 pricing/docs: https://developers.cloudflare.com/r2/pricing/
- Hetzner Cloud docs/pricing entry: https://www.hetzner.com/cloud/
- Supabase pricing: https://supabase.com/pricing
- Resend pricing: https://resend.com/pricing
- Clerk docs: https://clerk.com/docs
- Google OAuth docs: https://developers.google.com/identity/protocols/oauth2

## Deployment Gates

- Web/API origin contract is explicit per environment:
  - local web: `http://127.0.0.1:3000` or `http://localhost:3000`
  - local API fallback when port 8000 is occupied: `http://127.0.0.1:8100`
  - staging web: public HTTPS Web origin
  - staging API: public HTTPS API origin
  - production web/API: final real domains only
- `NEXT_PUBLIC_API_BASE_URL` points at the matching API origin in each Web environment.
- FastAPI `TANGENT_ALLOWED_ORIGINS` allows only the matching Web origin(s) for that environment.
- Clerk allowed origins and redirect URLs include the exact staging/production Web domains before turning on required Web Auth.
- Local-only auth helpers such as `/api/auth/dev-bypass` and the `tangent_dev_auth` cookie remain disabled in production and are never used for staging/prod acceptance.
- Tracked deploy docs stay redacted. The live staging runtime truth now belongs in Vercel env, the private server-local shared staging `api.env` mirrored into the active release, provider dashboards and private operator storage, while repo docs record only safe facts and checklist state.
- Nested env shadow files such as `apps/web/.env.local` or pulled `.vercel/.env.production.local` copies must never override deployed Web secrets; the deployed Web lane reads only the Vercel project env for its target environment.
- Staging deployment should use release-style directories such as `~/apps/Tangent_release_<sha>` instead of mutating a long-lived checkout. The active release may receive `deploy/staging/api.env` as a copy or symlink from a private server-local shared secret store.
- Public staging DNS remains proxied through Cloudflare, and SSL mode stays Full (strict) instead of Flexible.
- Public FastAPI `/health` returns 200 over HTTPS.
- Public staging Web/API pass `ops_readiness_smoke.py`, or failures are tracked as explicit external-infra blockers.
- CORS allows only staging Web origin.
- Vercel route can call FastAPI.
- Google OAuth login returns a provider JWT in staging.
- FastAPI rejects invalid provider JWTs and accepts valid staging JWTs.
- Alembic migration succeeds against staging Postgres.
- Asset upload/read succeeds through R2.
- Board save/load/history works through staging API.
- Board realtime process updates stay in WebSocket room memory; only compacted/final snapshots are persisted to Postgres unless `TANGENT_BOARD_REALTIME_PERSIST_MODE=update_chain` is explicitly set for a rollback.
- Signed-in browser acceptance covers Board create/open/save/delete, paste/upload placeholder -> persisted Asset, reload, history and thumbnail behavior.
- Guard rejects `data:` and `blob:` documents.
- A production runbook and env template exist before public launch.
- Rollback path is documented.
