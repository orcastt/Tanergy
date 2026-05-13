# Project State Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-13
**Status**: In progress; staging Web/API/Neon/R2 smoke passed, Konva-first redeploy smoke pending.

## Objective

Stand up public staging Web/API with Postgres, R2 and email provider wiring, then redeploy the Konva-first Board route with tldraw disabled by default.

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

- [ ] Add staging Web redirect URL to Auth provider.
- [ ] Add local dev redirect URL to Auth provider.
- [ ] Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or provider equivalent to Vercel.
- [ ] Add `CLERK_SECRET_KEY` or provider equivalent to server-only secrets.
- [ ] Add JWT issuer/audience/JWKS config to FastAPI secrets.
- [ ] Keep Google Client Secret only inside Auth provider/server-side config.

## Smoke Tests

- [x] `/health` over HTTPS.
- [x] CORS from staging Web origin.
- [x] Alembic migration against staging DB.
- [x] Asset upload/read through R2.
- [x] Board save/load/history through staging API.
- [x] Vercel Web domain opens Workspace/Board routes.
- [ ] Konva-first `/boards/[boardId]` route opens new Boards on staging without tldraw license blocker.
- [ ] Production-like env keeps tldraw reference disabled unless explicitly enabled.
- [ ] OTP email delivered to test inbox.
- [ ] Google OAuth login on staging returns provider session/JWT.
- [ ] FastAPI rejects invalid/expired provider JWT.

## Current Staging Result

- FastAPI is deployed on the Hetzner staging host behind Caddy.
- Public API health is live at the staging API domain.
- Neon migration reached S1A head.
- Temporary dev user/workspace seed exists for pre-Auth smoke.
- Board save/load/history, guard rejection and R2 asset upload/read passed.
- Vercel staging domain opens the Web app and calls the staging FastAPI origin.
- Public Board route exposed the tldraw production license requirement before S1X. S1X now has a Konva-first route and production tldraw reference gate locally; staging needs redeploy/smoke with that setting.
- `TANGENT_REQUIRE_API_AUTH=0` remains intentional until S1C Clerk/JWT verification lands.
- User-confirmed Clerk and Google OAuth provider setup exists; staging browser/API smoke still needs to prove the full session/JWT path.
- Runtime Postgres connections now prefer `DATABASE_POOL_URL` when present while keeping Alembic on `DATABASE_URL`; backend cursors log SQL taking longer than `TANGENT_DATABASE_SLOW_QUERY_MS` without logging parameters. This is the first targeted Neon/slow-query observability cleanup from the project-wide memory/performance audit.

## Handoff Notes

- Keep staging/prod env vars separate.
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
- Production Google OAuth requires Google Cloud Console setup, verified domain, app branding, privacy policy and terms URLs.
- Use `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` for the current deploy/database/Auth/AI/Admin/collaboration acceptance checklist.
