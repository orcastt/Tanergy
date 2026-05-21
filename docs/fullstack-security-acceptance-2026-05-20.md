# Fullstack Security Acceptance Report

Date: 2026-05-20

This report records the current repo-level fullstack and security acceptance
state after the P0/P1 hardening pass. It separates what is complete in code from
what still requires a redeployed staging environment or external provider
dashboard proof.

## Local Acceptance Result

Status: Passed.

Command:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_release_gate.py \
  --env-file deploy/staging/api.env.example
```

Result summary:

| Gate | Result |
| --- | --- |
| Next security guard smoke | Passed |
| Local share password smoke | Passed |
| Public share client smoke | Passed |
| Static security guard | Passed |
| `npm audit --audit-level=high` | Passed |
| Web typecheck | Passed |
| Web lint | Passed |
| Web production build | Passed |
| Playwright public security E2E | 28 passed |
| API compileall | Passed |
| API performance smoke | Passed |
| Backend pytest | 373 passed |
| Deployment config smoke | Passed with optional warnings |
| `git diff --check` | Passed |

The local gate intentionally skipped live external checks: Redis connectivity,
object-storage proof, external ops proof and staging auth smoke. Those require
real private staging/production credentials and provider dashboards.

## Local Security Coverage

The current automated coverage includes:

- BOLA/IDOR tests for Board, Workspace, Admin and Billing boundaries.
- CSRF/origin guards for Next write routes.
- CORS and WebSocket Origin checks for production-like deployments.
- WebSocket message rate, connection limits and per-message edit-permission
  revalidation.
- Public share strong-token, expiration, password, revoke and `noindex`
  behavior.
- Upload and remote import SSRF, MIME/magic-byte, SVG/PDF and unsafe URL
  rejection.
- XSS guardrails for unsafe URLs, dangerous DOM sinks and public share paths.
- Redis-backed anti-abuse code paths and scriptable Redis smoke.
- Daily business quota and idempotency coverage for high-cost/write paths.
- Team seat-cap invite enforcement.
- Public security headers and anti-crawl E2E checks across Chromium, Firefox,
  WebKit and Chromium mobile.

## Public Staging Smoke

Command:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://staging.tanergy.cc \
  --api-url https://api-staging.tanergy.cc \
  --origin https://staging.tanergy.cc
```

Current result: Passed after the 2026-05-20 staging redeploy and the follow-up
Vercel env sync/redeploy.

Staging comparison:

| Area | Previous staging result | Current staging result |
| --- | --- | --- |
| Web/API security headers | Public smoke failed because the deployed release had not picked up the security-header changes. | Web home and API `/health` now include the required headers; `apiHealth.missingHeaders` is empty. |
| API health caching | `/health` returned 200 but was missing `Cache-Control`. | `/health` returns 200 with `Cache-Control: no-store`. |
| Public entry checks | TLS, static cache and CORS were already green. | TLS, Web home, static cache, API health and CORS are all green. |
| Deployed release | Earlier GeekAI staging deploy stopped on Alembic `20260520_0033`, then the first API restart kept the older container image running. | API remains healthy on release `b35adc0`; Alembic is at `20260520_0033 (head)`. Web was redeployed from the current worktree to Vercel deployment `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg` after syncing server-only GeekAI env. |

Validated checks:

- Web TLS certificate valid, 72 days left at the time of smoke.
- API TLS certificate valid, 72 days left at the time of smoke.
- Web home returned 200 with required security headers.
- Next static assets returned `public, max-age=31536000, immutable`.
- API `/health` returned 200 with required security headers.
- API CORS preflight accepted only the staging Web origin used in the smoke.
- Web `Chat` SSE proxy now has the required server-only GeekAI env on Vercel
  and returned `200` with `Content-Type: text/event-stream` plus multiple
  `data:` chunks for `qwq-plus-latest`. A second low-token smoke saw 49
  reasoning chunks and final content `OK`, so the transport is live; visible
  node text still depends on providers emitting ordinary `delta.content`.

Deployment limitation:

- The API host SSH attempt from this workstation failed with
  `Permission denied (publickey)`, so the current FastAPI container was not
  redeployed from the uncommitted local backend changes in this pass. API-side
  fixes such as provider output byte-MIME persistence still require API host
  deploy access or CI deployment before they can be marked live-accepted.

## External Proof Gates

These gates are now scriptable and should fail until real provider setup is
complete.

Object storage:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_object_storage_smoke.py \
  --env-file deploy/staging/api.env \
  --required \
  --probe-public-url
```

External ops proof:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_external_proof_smoke.py \
  --env-file deploy/staging/api.env \
  --production-like \
  --required \
  --check-urls
```

Required private evidence:

- Real Redis security counter connectivity.
- Real R2/S3 temporary write/read/delete and public-read isolation.
- Real Clerk/OIDC bearer token staging auth smoke.
- 15-client staging WebSocket load smoke.
- Cloudflare WAF and rate-limit rules enabled.
- Managed Postgres PITR enabled, RPO/RTO documented and restore drill completed.
- External uptime monitor and status page configured.
- Sentry/APM DSNs, source-map upload and alert routing configured.
- Payment provider test-key smoke if checkout is included in the release.

## Residual Risk

`npm audit --audit-level=high` passes. A moderate Next/PostCSS advisory remains
through Next's bundled PostCSS dependency. npm currently suggests a breaking
force path, so this remains an upstream upgrade watch item rather than a safe
local force fix.

## Decision

Repo-level fullstack and security acceptance is green. Staging Web and public
ops readiness are green after the latest redeploy. Staging/production cannot be
called fully complete until the API host is redeployed from the same fix set,
signed-in browser checks pass, and the external proof gates above pass with real
private infrastructure.
