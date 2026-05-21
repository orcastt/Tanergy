# Deployment And Ops Readiness Acceptance

Last updated: 2026-05-20

This report covers deployment readiness outside the application security gate:
domains, SSL, environment separation, managed database posture, CDN/cache,
uptime monitoring, error tracking, performance monitoring and incident response.

Current fullstack acceptance report:
`docs/fullstack-security-acceptance-2026-05-20.md`.

## Automated Checks

Local deploy/config checks:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_deploy_config_smoke.py \
  --env-file deploy/staging/api.env.example \
  --production-like
```

External ops proof checks, after the provider dashboards are configured:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_external_proof_smoke.py \
  --env-file deploy/staging/api.env \
  --production-like \
  --required \
  --check-urls
```

Object-storage isolation checks, on a host that has real staging/production R2
credentials:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_object_storage_smoke.py \
  --env-file deploy/staging/api.env \
  --required \
  --probe-public-url
```

Public staging checks, after a deploy:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://staging.tanergy.cc \
  --api-url https://api-staging.tanergy.cc \
  --origin https://staging.tanergy.cc
```

Production checks, before public launch:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://app.example.com \
  --api-url https://api.example.com \
  --origin https://app.example.com \
  --require-hsts \
  --require-static-cache
```

## Acceptance Matrix

| Area | Current State | Blocker Before Production |
| --- | --- | --- |
| Custom domains and SSL | Staging Web/API domains are documented with Cloudflare Full strict. `ops_readiness_smoke.py` now verifies HTTPS certificates and security headers. | Production Web/API domains must pass the smoke with real domains and valid certs. |
| Environment management | Local, staging API, production API and new Vercel Web env templates are split. Secrets stay in Vercel/server/private storage. | Confirm production Vercel env and API env are separate from staging. |
| Database hosting | Staging is Supabase Pro managed Postgres; production requires a separate managed database. `ops_external_proof_smoke.py` now requires PITR, restore-drill timestamp, RPO and RTO evidence when run as a production-like gate. | Enable and document backups/PITR, retention, restore drill, RPO and RTO. |
| CDN/cache | Vercel/Cloudflare are the current edge layers. The smoke can verify Next static asset cache headers. | Define asset-domain policy and long-cache rules for public/static assets. |
| Uptime monitoring | `/health` and Docker healthchecks exist; public smoke verifies `/health`; external monitor/status-page env proof is now scriptable. | Add external monitor, alert channel, 5xx/origin-unreachable alerts and status page. |
| Error tracking | Optional Sentry SDK wiring exists for Next client/server/edge and FastAPI. Events scrub query strings, cookies and sensitive headers, and the browser sets Clerk user id only; external DSN/proof is now scriptable. | Configure Sentry or equivalent DSNs, source-map upload, severity routing and alert owners. |
| Performance monitoring | API slow-response and memory RSS warnings now log without query params; slow SQL logging already exists; optional Sentry traces sample rate is templated and checked. | Add APM/dashboard alerts for p95 latency, DB duration and memory. |
| Incident handbook | Runbook now exists in `docs/incident-response-runbook.md`. | Assign on-call owners/channels and run one tabletop drill. |

## Current Residual Risks

- Current public staging check on 2026-05-20 is green after the `b35adc0`
  API redeploy and the follow-up Vercel deployment
  `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg`: Web/API TLS, Web home security
  headers, Next static asset cache, API `/health` security headers and CORS
  preflight all passed.
- Vercel server-only GeekAI env has been synced for the staging project. A
  direct `/api/ai/chat/completions` smoke now returns `text/event-stream` and
  live SSE chunks for `qwq-plus-latest`.
- API host SSH from this workstation currently fails with
  `Permission denied (publickey)`. Treat API-side uncommitted local fixes as
  pending deployment until the staging deploy key/CI path is restored.
- The previous public staging check failed Web home and API `/health`
  security-header checks because the deployed release had not picked up the
  repo change yet. That is resolved in the current staging release.
- The full local security gate passed on 2026-05-20, including Web build, 28
  Playwright E2E checks, API compileall, API performance smoke and 367 backend
  tests.
- The API `/health` remains intentionally shallow. Use external monitors plus
  staging smoke scripts for DB/R2/Auth/provider checks.
- Error reporting remains inactive until DSNs and source-map upload credentials
  are configured in Vercel/API runtime env and pass the external proof smoke.
- Backup/PITR still must be enabled and tested in Supabase or the chosen
  managed Postgres provider, but the repo now has a failing smoke for the
  required evidence fields.
- Cloudflare WAF, bot rules and rate-limit dashboard settings are external
  configuration, but the required proof fields are now checked by script.
- `npm audit --omit=dev` still reports a moderate Next/PostCSS advisory through
  Next's bundled PostCSS. Track an upstream Next/PostCSS upgrade; do not force a
  breaking audit fix into production.

## Decision

The repo now has executable deployment readiness smoke tests and runbooks. It is
ready for staging ops verification, but production remains blocked until the
external monitoring, backup/PITR, status page, WAF/rate limits, object storage
and Sentry/APM services are configured and the new proof smokes pass.
