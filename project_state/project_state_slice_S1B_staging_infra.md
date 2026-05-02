# Project State Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-02
**Status**: Waiting on external resources.

## Objective

Stand up public staging Web/API with Postgres, R2 and email provider wiring.

## Detailed Runbook

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

## Resources To Prepare

- [ ] Domain under Cloudflare DNS.
- [ ] Vercel project connected to GitHub.
- [ ] FastAPI host, likely Hetzner VPS or equivalent.
- [ ] Managed Postgres project, Supabase or Neon acceptable for staging.
- [ ] Cloudflare R2 bucket and S3 credentials.
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

- [ ] `/health` over HTTPS.
- [ ] CORS from staging Web origin.
- [ ] Alembic migration against staging DB.
- [ ] Asset upload/read through R2.
- [ ] Board save/load/history through staging API.
- [ ] OTP email delivered to test inbox.
- [ ] Google OAuth login on staging returns provider session/JWT.
- [ ] FastAPI rejects invalid/expired provider JWT.

## Handoff Notes

- Keep staging/prod env vars separate.
- Do not expose server keys to Vercel public env.
- Keep firewall narrow: public 80/443, SSH restricted where possible.
- Production Google OAuth requires Google Cloud Console setup, verified domain, app branding, privacy policy and terms URLs.
