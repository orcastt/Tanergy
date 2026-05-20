# TANGENT Production Deployment Runbook

This folder defines the production deployment boundary before the real public site is opened.

Production is not a copy of staging with a new domain. It must run with separate infrastructure, separate secrets and a stricter promotion flow.

## Secret Recording Rule

- Runtime secrets belong in Vercel env, the production API `api.env`, provider dashboards, and private operator storage.
- Tracked repo docs may record only status, scope, and checklist state.
- Do not store raw production keys, passwords, bearer tokens, or connection strings in `ARCH/`, `PRD/`, `project_state/`, `dev-plans/`, or tracked deploy markdown files.
- The current FastAPI bearer verifier uses `CLERK_JWT_ISSUER`, `CLERK_JWKS_URL`, optional `CLERK_JWT_AUDIENCE`, and `CLERK_AUTHORIZED_PARTIES`; it does not require `CLERK_SECRET_KEY` for JWT verification itself, but the API runtime now does need `CLERK_SECRET_KEY` for self-service account deletion and admin hard-delete flows.

## Current Policy

- `staging.tanergy.cc` and `api-staging.tanergy.cc` remain the internal acceptance environment.
- Production stays closed until staging has passed real Auth, real email/OAuth and one live AI provider smoke.
- Promote one reviewed commit from staging to production. Do not hot-edit production first and reconcile later.

## Recommended Production Shape

```text
Browser
  -> app.<domain> or <domain>
  -> api.<domain>
      -> production Postgres
      -> production R2 bucket
      -> production Clerk project/keys
      -> production email provider config
      -> production payment mode/webhooks
      -> live AI provider credentials
```

Recommended concrete split:

- Web: separate Vercel production project, or at minimum a separate production environment with its own protected domains and secrets.
- API: separate production compose stack and env file. A separate VPS is preferred once real users exist.
- Database: separate production database and database role. Do not share staging schemas or credentials.
- Assets: separate production R2 bucket. If cost forces one bucket, use separate prefixes plus separate API keys, but a separate bucket is strongly preferred.
- Auth: separate Clerk production keys and production redirect/origin settings.
- Billing/payments: separate live-mode secrets and live webhook endpoints.

## Hard Separation Rules

These are not optional:

1. Staging and production never share `DATABASE_URL`, `DATABASE_POOL_URL` or database passwords.
2. Staging and production never share R2 write credentials.
3. Staging and production never share Clerk secret keys or redirect URL configuration.
4. Staging and production never share payment webhook endpoints or live/test payment credentials.
5. Staging deploy helpers such as `/api/auth/dev-bypass` and `tangent_dev_auth` stay disabled.
6. Production `TANGENT_REQUIRE_API_AUTH` must be `1`.

## Suggested Domain Layout

```text
staging.tanergy.cc         -> internal web acceptance
api-staging.tanergy.cc     -> internal API acceptance

app.tanergy.cc             -> production web
api.tanergy.cc             -> production API
assets.tanergy.cc          -> optional public asset domain
```

If you choose the root domain for the app instead of `app.`, update Clerk authorized parties, Google OAuth redirects and CORS to match exactly.

## Production Secrets To Prepare

Web / Vercel:

- `NEXT_PUBLIC_API_BASE_URL=https://api.<domain>`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` when error tracking is enabled
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` when uploading source maps

API / server:

- `DATABASE_URL`
- `DATABASE_POOL_URL`
- `CLERK_JWT_ISSUER`
- `CLERK_JWT_AUDIENCE`
- `CLERK_JWKS_URL`
- `CLERK_AUTHORIZED_PARTIES=https://app.<domain>`
- `TANGENT_ALLOWED_ORIGINS=https://app.<domain>`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `RESEND_API_KEY` or the chosen email provider key
- `SENTRY_DSN` or `TANGENT_ERROR_TRACKING_DSN` when backend error tracking is enabled
- live AI provider keys such as `GEEKAI_BALANCE_IMAGE_API_KEY` and `GEEKAI_TEXT_API_KEY`
- future payment live secrets and webhook secrets

Use [api.env.example](./api.env.example) as the production API template and [docker-compose.api.yml](./docker-compose.api.yml) as the production API compose file.

## Provisioning Order

1. Provision production database.
   - Create a separate Supabase project/database or another dedicated managed Postgres instance.
   - Create a dedicated production DB user and password.
   - Record both the direct URL and pooled URL.

2. Provision production object storage.
   - Create `tanergy-production-assets` or an equivalent dedicated bucket.
   - Create bucket-scoped read/write credentials for production only.

3. Provision production Auth/email/payment settings.
   - Add production web redirect URLs to Clerk.
   - Add production authorized parties and JWT settings.
   - Verify the email sending domain for real user traffic.
   - Keep payment provider in live mode only after the rest of production smoke is green.

4. Provision production API runtime.
   - Copy `deploy/production/api.env.example` to an untracked `deploy/production/api.env`.
   - Fill production secrets.
   - Run Alembic on `DATABASE_URL`.
   - Bring the API up behind TLS.

5. Provision production web runtime.
   - Add production Vercel env vars.
   - Point the production domain to the production deployment.
   - Confirm the web app talks only to `https://api.<domain>`.

## API Server Steps

On the production API host:

```bash
git clone <repo-url> TanvasAgent
cd TanvasAgent
cp deploy/production/api.env.example deploy/production/api.env
```

Edit `deploy/production/api.env`, then run:

```bash
docker compose -f deploy/production/docker-compose.api.yml build api
docker compose -f deploy/production/docker-compose.api.yml run --rm \
  api alembic upgrade head
docker compose -f deploy/production/docker-compose.api.yml up -d api
curl https://api.<domain>/health
```

If production ends up with its own compose file or host layout later, keep the same env contract and smoke list.

## Promotion Flow

Recommended release flow:

1. Local branch passes lint/typecheck/build/tests.
2. Deploy to staging.
3. Run staging acceptance:
   - real Clerk login/logout
   - board list/open/save/load/history
   - asset upload and render
   - admin me / operator users / finance summary
   - one live AI provider smoke
4. Freeze the reviewed commit SHA.
5. Deploy the same commit to production.
6. Run production smoke before announcing availability.

Do not mix staging-only commits with production deploys after acceptance has started.

## Production Smoke Checklist

- Run the deployment configuration and public ops readiness smokes:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_deploy_config_smoke.py \
  --env-file deploy/production/api.env \
  --production-like

PYTHONPATH=services/api python3 services/api/scripts/security_object_storage_smoke.py \
  --env-file deploy/production/api.env \
  --required \
  --probe-public-url

PYTHONPATH=services/api python3 services/api/scripts/ops_external_proof_smoke.py \
  --env-file deploy/production/api.env \
  --production-like \
  --required \
  --check-urls

PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://app.<domain> \
  --api-url https://api.<domain> \
  --origin https://app.<domain> \
  --require-hsts \
  --require-static-cache
```

- `https://api.<domain>/health` returns `200`.
- Clerk sign-in works from the real production domain.
- `/api/v1/auth/session` creates or resumes the local user/session row.
- Board list opens without dev fallback.
- Board save/load/history succeeds.
- Asset upload/paste/import renders after refresh.
- `/admin` denies non-admin users and admits a real admin role.
- one live AI text or image run completes through the backend `AiRun` path.
- slow SQL log stays quiet on the common board/admin paths.

## Ops Readiness References

- Readiness acceptance: `docs/ops-readiness-acceptance.md`.
- Incident response: `docs/incident-response-runbook.md`.
- External monitor owner: TODO; alert channel: TODO; status-page owner: TODO.
- Backups/PITR: TODO owner must confirm retention, restore drill date, RTO and
  RPO before launch.
- Error tracking: TODO owner must configure Sentry or equivalent DSN, source maps
  and severity routing before launch.
- Status page: publish investigating updates for user-visible API down,
  database-loss, provider-outage, security, DNS/SSL and object-storage incidents.

## Rollback

If a production deploy is bad:

1. Roll the web deployment back to the last known-good Vercel deployment.
2. Roll the API container back to the last known-good image or commit.
3. Do not roll database schema backward unless the migration was explicitly written to be reversible and tested.
4. If the issue is secrets-related, rotate the affected secret before reopening traffic.

## Before Opening Production

Do not open the production domain to real users until all of these are true:

- staging real Auth smoke is green
- staging email/Google OAuth smoke is green
- staging admin smoke is green under strict auth
- staging board + asset flows are green after refresh
- one live AI smoke is green without mock fallback
- production secrets are separate from staging
