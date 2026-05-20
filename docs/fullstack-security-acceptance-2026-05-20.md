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
| Backend pytest | 367 passed |
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

Current result: Failed because the public staging deploy has not picked up the
new security-header release yet.

Passed:

- Web TLS certificate is valid.
- API TLS certificate is valid.
- Next static asset cache header is valid.
- API CORS preflight accepts the staging origin.

Failed:

- Web home is missing `content-security-policy`, `referrer-policy`,
  `x-content-type-options` and `x-frame-options`.
- API `/health` is missing `cache-control`, `referrer-policy`,
  `x-content-type-options` and `x-frame-options`.

Required next action: redeploy the current Web/API revision to staging, then
rerun the public ops smoke.

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

Repo-level fullstack and security acceptance is green. Staging/production cannot
be called fully complete until the public staging redeploy and the external proof
gates above pass with real private infrastructure.
