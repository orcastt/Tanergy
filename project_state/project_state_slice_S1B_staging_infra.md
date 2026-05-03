# Project State Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-03
**Status**: In progress; staging Web/API/Neon/R2 smoke passed, tldraw production license exposed.

## Objective

Stand up public staging Web/API with Postgres, R2 and email provider wiring.

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
- [ ] Clerk or Supabase Auth staging project.
- [ ] Google social login enabled in Auth provider.
- [ ] Google Cloud OAuth production Client ID/Secret prepared before public launch.

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
- Public Board route now exposes the tldraw production license requirement; S1X covers the long-term replacement evaluation.
- `TANGENT_REQUIRE_API_AUTH=0` remains intentional until S1C Clerk/JWT verification lands.

## Handoff Notes

- Keep staging/prod env vars separate.
- Do not expose server keys to Vercel public env.
- Keep firewall narrow: public 80/443, SSH restricted where possible.
- Production Google OAuth requires Google Cloud Console setup, verified domain, app branding, privacy policy and terms URLs.
