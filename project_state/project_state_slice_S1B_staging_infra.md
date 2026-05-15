# Project State Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-15
**Status**: In progress; the rebuilt Hetzner staging API host is back online, public HTTPS API smoke is green again, local-against-real-DB plus public API smoke now pass against Neon + R2, the public Vercel alias now points to a fresh Konva-only web deploy, Cloudflare-proxied staging Web/API records with Full (strict) TLS are in place, real Clerk session/admin smoke is green, the tracked staging deploy docs are now redacted back to placeholder/checklist form, and a production deploy runbook/env template are prepared. The first signed-in board/browser pass is now green; the remaining gates are the second-round reopen/conflict/thumbnail edge cases, Google/email verification and one live provider AI smoke.

## Objective

Stand up public staging Web/API with Postgres, R2 and email provider wiring, then redeploy the Konva-only Board route and verify legacy Board documents remain blocked in the active app path.

## Detailed Runbook

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

## Resources To Prepare

- [x] Domain under Cloudflare DNS.
- [x] Vercel project connected to GitHub.
- [x] FastAPI host, likely Hetzner VPS or equivalent.
- [x] Managed Postgres project, Supabase or Neon acceptable for staging.
- [x] Cloudflare R2 bucket and S3 credentials.
- [ ] Email provider account and verified sending domain.
- [x] Clerk Auth project prepared.
- [x] Google social login configured in Clerk.
- [x] Google Cloud OAuth Client ID/Secret prepared and entered into Clerk.

## Auth And Google OAuth Setup

- [x] Add staging Web redirect URL to Auth provider.
- [ ] Add local dev redirect URL to Auth provider.
- [x] Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or provider equivalent to Vercel.
- [x] Add `CLERK_SECRET_KEY` or provider equivalent to server-only secrets.
- [x] Add JWT issuer/audience/JWKS config to FastAPI secrets.
- [ ] Keep Google Client Secret only inside Auth provider/server-side config.

## Smoke Tests

- [x] `/health` over HTTPS.
- [x] CORS from staging Web origin.
- [x] Alembic migration against staging DB.
- [x] Asset upload/read through R2.
- [x] Board save/load/history through staging API.
- [x] Vercel Web domain opens Workspace/Board routes.
- [x] Public staging Web/API DNS stays behind Cloudflare proxying with Full (strict) TLS.
- [x] Konva-only `/boards/[boardId]` route opens new Boards on staging without any legacy canvas dependency.
- [x] Production-like env blocks legacy v1/unknown Board documents in the active app path.
- [x] First signed-in board/browser pass covers Board create/open/save/delete plus paste/upload -> reload behavior.
- [ ] Second-round board/browser acceptance now looks green on solo reopen, History persistence, thumbnail persistence and current private-board owner flows; the remaining explicit browser issue is the `Manage board -> Copy board` Free-plan limit modal path.
- [ ] Email-based staging auth smoke delivers to a test inbox, returns to `/workspaces`, and preserves the expected session shape. This is still pending because Clerk email auth is not yet enabled for the current lane.
- [x] Google OAuth login on staging returns provider session/JWT.
- [ ] FastAPI rejects invalid/expired provider JWT.

## Current Staging Result

- The rebuilt Hetzner host now runs Ubuntu 24.04 with Docker, Caddy, UFW, fail2ban and a non-root `deploy` user; SSH password login is disabled and the compromised old staging key was replaced.
- Source-host firewall is now explicitly tightened: public traffic is limited to `80/tcp` and `443/tcp`, while `22/tcp` is restricted to the maintainer's current public IP instead of remaining open to the Internet.
- FastAPI is deployed again behind Caddy at `https://api-staging.tanergy.cc`.
- Public API health is live again at the staging API domain.
- Neon migration is now at Alembic head on the rebuilt host.
- Temporary dev user/workspace seed still exists for the pre-Auth smoke lane.
- Local-against-real-DB and public API smoke both passed for:
  - `/health`
  - CORS from `https://staging.tanergy.cc`
  - R2 asset upload/read
  - Board save/load
  - Board snapshot create/load
  - Board guard rejection on inline `data:` payloads
- Root `.vercelignore` now excludes local board snapshots, asset caches and nested Next build output, which cut the staging web upload from roughly `268.6MB` down to about `470KB` and unblocked production publishing from the repo root.
- Vercel production now has the missing server-side `CLERK_SECRET_KEY`, and `https://staging.tanergy.cc` has been re-aliased to a fresh deploy after the secret fix.
- Cloudflare DNS now proxies both public staging records, but the source split remains intentional:
  - `staging.tanergy.cc` stays a proxied Vercel CNAME
  - `api-staging.tanergy.cc` stays a proxied Hetzner A record
- Cloudflare SSL/TLS is now explicitly set to Full (strict) for the staging domains, so browser traffic stays on the proxied Web/API records while origin validation remains enabled.
- `https://staging.tanergy.cc/boards/[boardId]` now returns `200` in the signed-out Clerk-protected state instead of `500`, and the active deployment no longer exposes the old tldraw license/runtime surface.
- Real signed-in staging smoke is now green for `/api/auth/session`, `/api/admin-proxy/me`, `/api/admin-proxy/operator/users?limit=3`, `/api/admin-proxy/finance/summary` and `/api/admin-proxy/ai/route-metrics?limit=5`.
- The first signed-in browser pass is now green on staging for Google login, `/workspaces`, board open, refresh/session persistence, private-board create/delete, paste/upload and reload recovery.
- The second-round signed-in browser pass is now mostly green too: solo reopen is acceptable, History persistence is acceptable, thumbnail persistence is acceptable, private-board owner delete/copy is acceptable, and Google re-login is acceptable.
- The remaining explicit browser edge is now the `Manage board -> Copy board` Free-plan limit modal path.
- Runtime Postgres connections now prefer `DATABASE_POOL_URL` when present while keeping Alembic on `DATABASE_URL`; backend cursors log SQL taking longer than `TANGENT_DATABASE_SLOW_QUERY_MS` without logging parameters.
- Clerk/Google/email runtime secrets have been restored enough for real session/admin smoke; Google is now manually green, while remaining work is one email-based staging auth smoke through Clerk once that method is enabled, plus any last secret cleanup before wider staging use.
- The tracked staging deployment worksheet no longer stores raw live secrets; runtime truth should now be maintained only in Vercel env, the staging server `deploy/staging/api.env`, provider dashboards and private operator storage.
- Cloudflare edge hardening is now partly in place: proxied DNS, Full (strict) TLS and source-host firewall narrowing are done, while deeper WAF/rate-limit coverage still needs either remaining free-plan room or a paid/security-specific follow-up.
- `deploy/production/README.md` and `deploy/production/api.env.example` now define the production boundary: separate web/API domains, separate database/storage/auth/payment secrets and a stage-to-prod promotion flow from one reviewed commit.
- Staging live AI acceptance is now explicitly blocked on a real provider credential such as `GEEKAI_API_KEY`; deployed environments should no longer fake-success through local mock asset ids.

## Handoff Notes

- Keep staging/prod env vars separate.
- The rebuilt staging host now expects the new local SSH key `~/.ssh/tanergy_staging_20260514_ed25519`; do not reuse the retired staging key.
- Preserve the local vs deployed route split:
  - local Web uses `http://127.0.0.1:3000` or `http://localhost:3000`
  - local API may use `http://127.0.0.1:8100` when another service occupies `8000`
  - staging/prod Web must use the real HTTPS domain
  - staging/prod API must use the real HTTPS API domain
- Every deployment needs `NEXT_PUBLIC_API_BASE_URL`, FastAPI `TANGENT_ALLOWED_ORIGINS`, and Clerk allowed origins/redirect URLs to agree on the exact domains.
- For Neon or other serverless Postgres providers, set `DATABASE_POOL_URL` to the provider's pooled connection string for the API runtime and keep `DATABASE_URL` as the direct migration/admin URL.
- Local `/api/auth/dev-bypass` and `tangent_dev_auth` are development helpers only; do not count them as staging/prod Auth smoke.
- Do not expose server keys to Vercel public env.
- Keep firewall narrow: public 80/443, SSH restricted where possible.
- Do not repoint `staging.tanergy.cc` from Vercel to the Hetzner API host just because both records are now proxied through Cloudflare. The web/API source split is still intentional.
- Keep production separate from staging: separate Vercel env/project, separate API env file or host, separate DB credentials, separate R2 write keys, separate Clerk keys and separate payment mode/webhooks.
- `services/api/tangent_api/env_bootstrap.py` now tolerates wheel-installed/container layouts instead of assuming the source tree always lives four parents above the module path. This was required to get the rebuilt staging container to boot cleanly.
- Production Google OAuth requires Google Cloud Console setup, verified domain, app branding, privacy policy and terms URLs.
- Use `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` for the current deploy/database/Auth/AI/Admin/collaboration acceptance checklist.
