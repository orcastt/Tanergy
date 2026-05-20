# Security Release Acceptance

Last updated: 2026-05-20

This document is the security-engineering release checklist for the current
web-first Tanergy canvas. It separates checks that are automated locally from
checks that must run against staging with real credentials and infrastructure.

Current acceptance report: `docs/fullstack-security-acceptance-2026-05-20.md`.

## Release Gate Command

Run the local gate before staging deploy:

```bash
npm run security:gate
```

Install browser engines once before the first E2E run:

```bash
npm -C apps/web run test:e2e:install
```

For staging, add the live checks:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_release_gate.py \
  --check-redis-connectivity \
  --check-object-storage \
  --require-external-ops-proof \
  --staging-base-url <api-url> \
  --staging-bearer-token <token> \
  --staging-workspace-id <workspace-id> \
  --staging-origin <app-origin>
```

## Automated Coverage

| Area | Status | Automated Evidence |
| --- | --- | --- |
| Unit and business logic tests | Covered for backend contracts | `PYTHONPATH=services/api python3 -m pytest services/api/tests` |
| API integration tests | Covered for auth, board, workspace, billing, admin, assets, share links and realtime | `services/api/tests/test_*` |
| UI/E2E smoke | Covered for public security headers, share noindex, public pages and path-injection XSS probe | `npm -C apps/web run test:e2e` |
| Browser/device matrix | Covered for Chromium, Firefox, WebKit desktop and Chromium mobile smoke | `apps/web/playwright.config.ts` |
| Boundary cases | Covered for many backend invalid input, role, share, upload and realtime abuse cases | backend pytest plus `apps/web/scripts/*security*.mjs` |
| Security tests | Covered for BOLA/IDOR, CSRF, CORS/origin, WebSocket abuse, XSS guardrails, upload SSRF/SVG/PDF and public anti-crawl headers | `npm run security:gate` |
| API performance smoke | Covered for low-cost API paths with p95/max thresholds | `security_api_performance_smoke.py` |
| Supply chain high severity | Covered at high severity threshold | `npm audit --audit-level=high` |

## Staging-Only Release Blockers

These checks cannot be proven from a local workstation when `.env` points at
container or staging-only services.

| Area | Required Staging Check |
| --- | --- |
| Redis distributed anti-abuse | `security_release_gate.py --check-redis-connectivity` or `security_redis_smoke.py --required` on a host that can resolve Redis |
| Real auth boundary | `security_staging_auth_smoke.py` with a real bearer token and workspace id |
| WebSocket multi-user load | `s4_realtime_multiplayer_load.py --clients 15` against staging collaboration service |
| Payment and checkout journey | Manual or E2E flow with staging payment provider test keys |
| Asset object storage isolation | `security_object_storage_smoke.py --required --probe-public-url` against staging object storage |
| External ops proof | `ops_external_proof_smoke.py --production-like --required` after WAF, PITR, alerts, status page and Sentry/APM are configured |

## Residual Risks

- Frontend has smoke-level E2E coverage, not full canvas workflow automation for
  every authenticated path. Add authenticated Playwright fixtures once stable
  test users and Clerk staging tokens are available.
- Performance thresholds are partly covered. Local API p95/max checks now run in
  the release gate, and realtime load is covered by the collaboration script.
  Canvas FPS, memory ceiling and authenticated page-load thresholds should be
  promoted into CI after staging baselines.
- `npm audit` currently passes at high severity after upgrading Next to 16.2.6.
  A moderate advisory remains in Next's bundled PostCSS dependency; npm only
  offers an unsafe force path, so track this until an upstream patch is available.

## Acceptance Decision

The code-level P0/P1 security hardening can enter staging when
`npm run security:gate` passes locally. Production readiness still requires the
staging-only checks above with real Redis, auth, storage, WebSocket, payment and
external ops infrastructure.

2026-05-20 result: the full local gate passed with Web build, 28 Playwright E2E
checks, API compileall, API performance smoke, 367 backend tests and
`git diff --check`. Public staging still needs a redeploy before the new
security headers appear on Web/API, and the real external proof gates require
private staging/production credentials.
