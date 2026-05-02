# ARCH Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-02
**Mode**: Architecture slice.
**Status**: Waiting on external resources.

## Goal

Create a real staging environment where the Next.js web app calls a public FastAPI API over HTTPS, FastAPI uses managed Postgres plus R2/S3-compatible object storage, and DNS/TLS/secrets are configured in a repeatable way.

## Target Deployment

```text
Browser
  -> Vercel Web: staging.tangent...
  -> FastAPI API: api-staging.tangent...
      -> Managed Postgres
      -> Cloudflare R2
      -> Email provider
      -> Auth provider: Clerk or Supabase Auth
      -> Google OAuth production client
```

## Recommended P0 Staging Choices

- Frontend: Vercel project connected to GitHub, with `NEXT_PUBLIC_API_BASE_URL` pointing at staging FastAPI.
- Backend: Hetzner Cloud VPS in US West/Hillsboro if using a fixed-cost VPS, or another US region close to both Asia and Europe.
- Database: managed Postgres, preferably Supabase or Neon for early staging.
- Object storage: Cloudflare R2 bucket using S3-compatible credentials.
- DNS/domain: Cloudflare DNS. Register domain at Cloudflare Registrar or point existing registrar nameservers to Cloudflare.
- Email: Resend or similar transactional email provider for OTP/magic-link delivery.
- Auth provider: Clerk preferred for P0 Google OAuth + Next.js UI; Supabase Auth acceptable if the team wants Auth and Postgres under one provider.
- Google OAuth: Auth provider development mode is acceptable locally, but production needs a Google Cloud OAuth client, verified domain, privacy policy URL and app branding.

## Purchase And Setup Checklist

Detailed beginner runbook:

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

1. Domain and DNS
   - Buy or transfer domain.
   - Put DNS under Cloudflare.
   - Reserve names:
     - `app.example.com` or `staging.example.com` for Vercel.
     - `api-staging.example.com` for FastAPI.
     - `assets.example.com` later if R2 public/custom domain is needed.

2. Vercel
   - Create team/project.
   - Connect GitHub repository.
   - Set environment variables:
     - `NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com`
   - Keep frontend server functions minimal; FastAPI remains API authority.

3. Hetzner or API host
   - Create Ubuntu VPS.
   - Add SSH key.
   - Install Docker and compose.
   - Configure firewall:
     - allow 22 from trusted IPs if possible
     - allow 80/443 public
     - block direct Postgres
   - Deploy FastAPI behind Caddy or Nginx with TLS.

4. Managed Postgres
   - Create staging DB.
   - Store `DATABASE_URL` only in server secrets.
   - Run Alembic migrations.
   - Confirm connection pooling or pool limits.

5. Cloudflare R2
   - Create bucket, example `tangent-staging-assets`.
   - Create access key with bucket-scoped permissions.
   - Configure server env:
     - `S3_ENDPOINT`
     - `S3_ACCESS_KEY_ID`
     - `S3_SECRET_ACCESS_KEY`
     - `S3_BUCKET`
     - `S3_PUBLIC_BASE_URL`
   - Add cache rules/CDN strategy before public traffic grows.

6. Email provider
   - Verify sending domain.
   - Add SPF/DKIM/DMARC DNS records.
   - Configure API key in FastAPI.
   - Smoke test OTP email to real mailbox.

7. Auth provider and Google OAuth
   - Create Clerk or Supabase Auth project for staging.
   - Enable Email address login.
   - Enable Google social login.
   - Add frontend env:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or provider equivalent.
   - Add server-only env:
     - `CLERK_SECRET_KEY` or provider equivalent.
     - `AUTH_PROVIDER=clerk`.
     - JWT issuer, audience and JWKS URL.
   - Configure allowed redirect URLs:
     - `https://staging.example.com`
     - local dev URL if needed.
   - For production, create Google Cloud OAuth 2.0 Client ID.
   - Add production domain, logo, privacy policy and terms URLs to Google OAuth consent configuration.
   - Put Google Client ID/Secret into the Auth provider production config, not into public app env.

8. Secrets
   - Store secrets in Vercel and server environment only.
   - Never expose API keys in frontend code.
   - Rotate staging keys before production.

## Official References

- Vercel pricing/docs: https://vercel.com/pricing
- Cloudflare R2 pricing/docs: https://developers.cloudflare.com/r2/pricing/
- Hetzner Cloud docs/pricing entry: https://www.hetzner.com/cloud/
- Supabase pricing: https://supabase.com/pricing
- Neon pricing: https://neon.com/pricing
- Resend pricing: https://resend.com/pricing
- Clerk docs: https://clerk.com/docs
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Google OAuth docs: https://developers.google.com/identity/protocols/oauth2

## Deployment Gates

- Public FastAPI `/health` returns 200 over HTTPS.
- CORS allows only staging Web origin.
- Vercel route can call FastAPI.
- Google OAuth login returns a provider JWT in staging.
- FastAPI rejects invalid provider JWTs and accepts valid staging JWTs.
- Alembic migration succeeds against staging Postgres.
- Asset upload/read succeeds through R2.
- Board save/load/history works through staging API.
- Guard rejects `data:` and `blob:` documents.
- Rollback path is documented.
