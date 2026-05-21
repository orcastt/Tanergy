# Project State Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-20
**Status**: In progress; the rebuilt Hetzner staging API host is back online, public HTTPS API smoke is green again, and the public Vercel alias points to the current Konva-only web deploy. The previous Neon staging project hit its monthly data-transfer quota and paused on 2026-05-17, and the API briefly used a Hetzner-local Docker Postgres container named `staging-postgres` as an emergency fallback. That server-local DB is now historical only and must not become a staging pattern. The Hetzner `staging-postgres` container and `staging_postgres_data` volume have been removed, the Cloudflare R2 `tanergy-assets` bucket was cleared to 0 objects, and staging has now been cut over to a fresh Supabase Pro Postgres project with Alembic applied to head. Board realtime persistence now defaults to final snapshots, so process `yjs-update` traffic stays in the WebSocket room and no longer debounce-writes every update chain to Postgres. Cloudflare-proxied staging Web/API records with Full (strict) TLS remain in place; deployment/ops readiness now has Web/API env templates, public TLS/header/CORS smoke, slow API/RSS observability logs and an acceptance report. The 2026-05-20 `b35adc0` API redeploy plus Vercel deployment `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg` make the public ops smoke fully green, and the staging Web runtime now has server-only GeekAI env for Chat SSE. External uptime monitoring, status page, backup/PITR drill, WAF/rate-limit dashboard confirmation and error tracking/APM remain production blockers. The post-stage browser regression fixes are split: Web/proxy/streaming code is deployed on Vercel, while FastAPI-side uncommitted local fixes still need API host deploy access because SSH from this workstation is currently rejected with `Permission denied (publickey)`. The remaining product gates are staging browser spot checks for these fixes, the Free-plan copy modal path, R2 clean asset smoke, re-created staging admin/workspace/board data, email verification and one real GeekAI-backed live AI smoke.

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
- [x] Supabase Pro managed Postgres staging project, created fresh with no Neon/Hetzner local restore.
- [x] Cloudflare R2 bucket and S3 credentials.
- [~] Uptime/status/error tracking/APM providers selected and wired. Repo env templates and smokes exist; external services still need operator setup.
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
- [x] Alembic migration against the previous staging DB.
- [x] Alembic migration against the fresh Supabase Pro staging DB.
- [x] Asset upload/read through the previous R2 bucket before cleanup.
- [ ] R2 clean-bucket or clean-prefix upload/read smoke after stale staging objects are deleted.
- [x] Board save/load/history through staging API.
- [x] Vercel Web domain opens Workspace/Board routes.
- [x] Public staging Web/API DNS stays behind Cloudflare proxying with Full (strict) TLS.
- [~] Public ops readiness smoke for Web/API TLS, headers, `/health` and CORS exists. Run it after each deploy and record any domain/dashboard failures.
- [x] Konva-only `/boards/[boardId]` route opens new Boards on staging without any legacy canvas dependency.
- [x] Production-like env blocks legacy v1/unknown Board documents in the active app path.
- [x] First signed-in board/browser pass covers Board create/open/save/delete plus paste/upload -> reload behavior.
- [ ] Second-round board/browser acceptance now looks green on solo reopen, History persistence, thumbnail persistence and current private-board owner flows; the remaining explicit browser check is the now-wired `Manage board -> Copy board` Free-plan limit modal path on staging.
- [ ] Email-based staging auth smoke delivers to a test inbox, returns to `/workspaces`, and preserves the expected session shape. This is still pending because Clerk email auth is not yet enabled for the current lane.
- [x] Google OAuth login on staging returns provider session/JWT.
- [~] FastAPI rejects invalid/expired provider JWT. Missing token and obviously malformed bearer token now return `401` on public staging with the expected CORS headers; a real expired/wrong-azp token smoke still remains.

## Current Staging Result

- The rebuilt Hetzner host now runs Ubuntu 24.04 with Docker, Caddy, UFW, fail2ban and a non-root `deploy` user; SSH password login is disabled and the compromised old staging key was replaced.
- Source-host firewall is now explicitly tightened: public traffic is limited to `80/tcp` and `443/tcp`, while `22/tcp` is restricted to the maintainer's current public IP instead of remaining open to the Internet.
- FastAPI is deployed again behind Caddy at `https://api-staging.tanergy.cc`.
- Public API health is live again at the staging API domain.
- 2026-05-17 temporary DB fallback: Neon paused the original staging project after exceeding its monthly data-transfer quota. The server-local `api.env` was backed up as `api.env.neon-quota-20260517214117.bak`, the active API env was briefly pointed at `staging-postgres:5432`, Alembic was applied to that temporary database, and `staging_postgres_data` was created as a provisional volume.
- 2026-05-18 cleanup execution: the Hetzner `staging-postgres` container and `staging_postgres_data` volume were removed, and the Cloudflare R2 `tanergy-assets` bucket was cleared to zero objects.
- 2026-05-18 Supabase cutover: the staging API env now points at the fresh Supabase Pro staging database, Alembic `upgrade head` completed successfully, the API container restarted, and both local host and public `https://api-staging.tanergy.cc/health` returned `{"status":"ok"}`.
- 2026-05-18 collaboration persistence update: `TANGENT_BOARD_REALTIME_PERSIST_MODE` now defaults to `final_snapshot`; ordinary websocket `yjs-update` process traffic broadcasts through the room without writing Postgres, while `sync-state-publish` / compacted state and room-empty finalize still persist the final realtime document snapshot.
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
- The `Manage board -> Copy board` Free-plan limit modal path is now wired locally across the workspace gallery plus dashboard/manage-panel copy entrypoints; the remaining explicit browser edge is a staging spot check after deploy.
- Previous staging checkpoint: release `fe568e1` restored the Konva-only Web/API lane and made public `/health`, Web `200`, invalid-token `401` and CORS preflight from `https://staging.tanergy.cc` green, but it did not include the later GeekAI route switch or final `/health` no-store header fix.
- Current staging checkpoint: Web is deployed at `https://staging.tanergy.cc` from Vercel deployment `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg`, API release `b35adc0` is running healthy behind `https://api-staging.tanergy.cc`, Docker health is green, and Alembic is at `20260520_0033 (head)`.
- Current public ops smoke is green: Web/API TLS, Web security headers, Next static cache, API `/health` with `Cache-Control: no-store`, and CORS preflight from the staging Web origin all passed.
- Vercel staging env now includes the server-only GeekAI text/image/video keys required by the Next AI bridge. A direct `POST https://staging.tanergy.cc/api/ai/chat/completions` smoke with `qwq-plus-latest` returned `200`, `Content-Type: text/event-stream` and streamed SSE `data:` chunks. The model emits `reasoning_content` chunks before final ordinary `content`, so transport is verified while UI-visible text still depends on content chunks.
- The retired dirty worktree `~/apps/Tangent` has now been removed too. Before deletion, its staging `api.env` was checked against the active release, confirmed identical, migrated into a private server-local shared secret copy, and mirrored back into the live release as `deploy/staging/api.env` so future cleanup no longer depends on the old tree.
- Runtime Postgres connections now prefer `DATABASE_POOL_URL` when present while keeping Alembic on `DATABASE_URL`; backend cursors log SQL taking longer than `TANGENT_DATABASE_SLOW_QUERY_MS` without logging parameters.
- 2026-05-20 ops readiness checkpoint: `deploy/staging/web.env.example` and `deploy/production/web.env.example` now define Web/Vercel env separation, `security_deploy_config_smoke.py` checks recommended observability env, and `ops_readiness_smoke.py` verifies public Web/API certificates, security headers, static cache hints, API `/health` and CORS.
- API middleware now logs slow HTTP responses via `TANGENT_API_SLOW_RESPONSE_MS` and high RSS warnings via `TANGENT_MEMORY_RSS_WARN_MB` / `TANGENT_MEMORY_LOG_INTERVAL_SECONDS`; the log message uses the path without query strings.
- Optional Sentry SDK wiring now exists for Next client/server/edge and FastAPI. It stays disabled without DSNs and scrubs cookies, query strings and sensitive headers before send.
- The previous 2026-05-20 public staging ops smoke passed TLS, CORS and static cache but failed Web home and API `/health` security-header checks because the deployed release had not picked up the security-header code yet. The current `b35adc0` release resolves this and `ops_readiness_smoke.py` now returns `ok: true`.
- `docs/ops-readiness-acceptance.md` records the current acceptance matrix. Production remains blocked until Cloudflare WAF/rate-limit rules, managed database backups/PITR and restore drill, uptime/status alerts, error tracking and APM dashboards are configured and tested outside the repo.
- Clerk/Google/email runtime secrets have been restored enough for real session/admin smoke; Google is now manually green, while remaining work is one email-based staging auth smoke through Clerk once that method is enabled, plus any last secret cleanup before wider staging use.
- The tracked staging deployment worksheet no longer stores raw live secrets; runtime truth should now be maintained only in Vercel env, the staging server-local shared `api.env` mirrored into the active release, provider dashboards and private operator storage.
- Cloudflare edge hardening is now partly in place: proxied DNS, Full (strict) TLS and source-host firewall narrowing are done, while deeper WAF/rate-limit coverage still needs either remaining free-plan room or a paid/security-specific follow-up.
- `deploy/production/README.md` and `deploy/production/api.env.example` now define the production boundary: separate web/API domains, separate database/storage/auth/payment secrets and a stage-to-prod promotion flow from one reviewed commit.
- Staging live AI acceptance is now explicitly blocked on one real GeekAI-backed live-provider image smoke with valid server env keys; deployed environments should no longer fake-success through local mock asset ids.
- The nested web env shadows under `apps/web/.env.local` and `apps/web/.vercel/.env.production.local` are now treated as non-authoritative; they exist only as local convenience files and must not be allowed to drift deployment truth.
- 2026-05-20 post-stage browser regression fix deployment split: Vercel now carries the admin/workspace proxy, strict frontend title validation and text SSE bridge changes, but the FastAPI API container could not be redeployed from this workstation because `ssh deploy@5.78.122.74` failed with `Permission denied (publickey)`. Do not mark backend Board title validation or provider byte-MIME storage as live-accepted until API deploy access is restored and the API host is redeployed.

## Handoff Notes

- Keep staging/prod env vars separate.
- The rebuilt staging host now expects the new local SSH key `~/.ssh/tanergy_staging_20260514_ed25519`; do not reuse the retired staging key.
- Preserve the local vs deployed route split:
  - local Web uses `http://127.0.0.1:3000` or `http://localhost:3000`
  - local API may use `http://127.0.0.1:8100` when another service occupies `8000`
  - staging/prod Web must use the real HTTPS domain
  - staging/prod API must use the real HTTPS API domain
- Every deployment needs `NEXT_PUBLIC_API_BASE_URL`, FastAPI `TANGENT_ALLOWED_ORIGINS`, and Clerk allowed origins/redirect URLs to agree on the exact domains.
- For Supabase or other serverless Postgres providers, set `DATABASE_POOL_URL` to the provider's pooled connection string for the API runtime and keep `DATABASE_URL` as the direct/session Alembic/admin URL when available.
- Do not restore the old Hetzner-local `staging-postgres` database and do not provision Hetzner server-local Postgres for staging again. Supabase Pro is now the staging database truth.
- Local `/api/auth/dev-bypass` and `tangent_dev_auth` are development helpers only; do not count them as staging/prod Auth smoke.
- Do not expose server keys to Vercel public env.
- Keep firewall narrow: public 80/443, SSH restricted where possible.
- Do not repoint `staging.tanergy.cc` from Vercel to the Hetzner API host just because both records are now proxied through Cloudflare. The web/API source split is still intentional.
- Keep production separate from staging: separate Vercel env/project, separate API env file or host, separate DB credentials, separate R2 write keys, separate Clerk keys and separate payment mode/webhooks.
- `services/api/tangent_api/env_bootstrap.py` now tolerates wheel-installed/container layouts instead of assuming the source tree always lives four parents above the module path. This was required to get the rebuilt staging container to boot cleanly.
- Production Google OAuth requires Google Cloud Console setup, verified domain, app branding, privacy policy and terms URLs.
- Use `dev-plans/p0-alpha-stabilization-and-acceptance-2026-05-06.md` for the release-spine acceptance checklist and `dev-plans/s1b-supabase-r2-redis-collaboration-infra-plan-2026-05-18.md` for the current database/R2/realtime infrastructure checklist. The old launch-readiness report now lives in `dev-plans/Archive/` for history only.
