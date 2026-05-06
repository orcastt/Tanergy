# PRD Slice S1B: Staging Infrastructure And Online Prep

**Updated**: 2026-05-06
**Status**: In progress; staging Web/API/Neon/R2 smoke passed, while email/Auth/OAuth and Konva-first redeploy smoke remain.

## User Value

The app becomes testable outside local dev. Real browsers can access staging Web, save Boards through staging API, upload assets to object storage and receive login emails.

## Requirements

- Staging Web deployed on Vercel.
- FastAPI deployed on a public HTTPS API host.
- Managed Postgres connected through `DATABASE_URL`.
- Cloudflare R2 bucket connected through S3-compatible config.
- DNS/TLS configured for Web and API.
- Email provider domain verified for Auth emails.
- Auth provider staging project configured.
- Google OAuth enabled for staging login.
- Production Google OAuth preparation documented before public launch.
- Konva-first Board route redeployed with tldraw disabled by default.

## Online Preparation Checklist

Beginner runbook:

```text
dev-plans/s1b-staging-deployment-runbook-2026-05-02.md
```

- Buy or connect domain and use Cloudflare DNS.
- Create Vercel project and connect GitHub.
- Create API VPS or PaaS app for FastAPI.
- Create managed Postgres project.
- Create R2 bucket and bucket-scoped credentials.
- Create email provider account and verify SPF/DKIM/DMARC.
- Create Clerk or Supabase Auth project.
- Enable Google social login in the Auth provider.
- Configure staging and local redirect URLs.
- Prepare Google Cloud OAuth Client ID/Secret for production domain before launch.
- Add staging environment variables.
- Keep production and staging secrets separate.

## Acceptance

- `https://api-staging.../health` returns 200.
- Vercel staging Web calls FastAPI with CORS allowed.
- Postgres migrations run.
- Asset upload/read works.
- Board save/load/history works against staging.
- Email OTP can be delivered to a test inbox.
- Google login succeeds on staging.
- FastAPI accepts valid provider JWT and rejects invalid/expired JWT.
- `/boards/[boardId]` opens Konva v2 on staging without the tldraw production license path.
