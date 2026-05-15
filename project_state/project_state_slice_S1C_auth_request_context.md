# Project State Slice S1C: Auth And Request Context

**Updated**: 2026-05-15
**Status**: Clerk frontend routes plus FastAPI bearer verification first pass landed. The current checkpoint also includes Tanergy-owned profile completion and editing: first real sign-in now gates on a profile modal, `/account` persists editable display name, `/forgot-password` exposes a real Clerk recovery flow, and session payloads now return `profileCompleted` so the frontend can stay honest about which layer owns what. The next gate is still the ordered second-round signed-in browser pass, then Google/email/logout hardening, with email currently scoped to one truthful staging smoke rather than a new native Tanergy-owned auth system.

## Objective

Replace dev headers/mock identity with real server-side sessions and workspace membership lookup.

## Work Items

- [~] Auth API contracts. Clerk-backed `/api/v1/auth/session` is first-pass; native OTP/logout/session-revocation routes remain pending.
- [x] Choose Auth provider for S1C implementation: Clerk preferred, Supabase Auth acceptable fallback.
- [x] Add Google OAuth signup/login flow in Clerk and Tanergy `/sign-in` / `/sign-up` pages.
- [x] Add Next.js provider shell: `ClerkProvider`, route protection proxy and account/avatar control.
- [x] Attach provider JWT to remote session, Board, Asset, Image Op and AI clients when `NEXT_PUBLIC_API_BASE_URL` points at FastAPI.
- [x] Add FastAPI JWT verification dependency for provider-issued tokens.
- [~] Map provider subject ids to local `tangent_users` and `tangent_user_identities`. `tangent_oauth_accounts` is still reserved for future direct provider-account linking flows. Latest authenticated session refresh now also updates `last_ip_address`.
- [ ] Session token hashing and revocation.
- [~] Email OTP issue/verify flow. Current release gate is one truthful staging email delivery/redirect smoke through the chosen provider path; native Tanergy-owned OTP endpoints remain later work.
- [x] Default workspace creation first pass.
- [x] Personal wallet creation on first verified local user session.
- [x] Tanergy-owned profile fields on `tangent_users` with editable Account UI.
- [x] First-session profile completion gate driven by the server session contract.
- [x] Visible Clerk-backed forgot-password flow.
- [x] Real-login admin smoke without local dev-bypass.
- [x] Admin operator bootstrap/grant path for the actual signed-in local TANGENT user after migrations. Script supports `--user-id` and `--email`.
- [~] Production-like Web/API origin and CORS contract for Clerk bearer requests. `azp` must now match configured `CLERK_AUTHORIZED_PARTIES` / allowed origins; deployed smoke still pending.
- [x] Request context middleware.
- [~] Active workspace selection matrix for users with multiple Team/Group memberships. First-pass server session now returns all validated memberships, server-returned workspace plan keys and rejects non-member requested workspaces; fuller product UI rollout is still pending.
- [ ] Rate limit and request logging for auth routes.
- [~] Tests for spoofed workspace/user ids. Required-auth missing-token and bearer-mode spoofed-user-header coverage exists; full workspace membership matrix is still pending.
- [ ] Tests for invalid, expired and wrong-audience provider JWTs.
- [ ] Google OAuth staging smoke returns a provider session/JWT and maps to the same local TANGENT user on repeat login.
- [ ] Email-based staging auth smoke reaches a test inbox, returns to `/workspaces`, and maps to the expected local TANGENT user/session.

Current release-order note:

- S1C is the first blocking verification lane together with S1B staging smoke.
- Public staging auth is now reachable enough for real session/admin smoke, so the immediate next path is the ordered second-round signed-in board/browser acceptance, then Google/email verification, then invalid-token/origin confirmation.

## Clerk-First Implementation Notes

Frontend:

```text
npm -C apps/web install @clerk/nextjs
apps/web/src/app/layout.tsx -> ClerkProvider
header/account entry -> SignInButton / UserButton
API client -> Authorization: Bearer <Clerk JWT>
```

Current frontend first pass:

```text
/                  -> Tanergy homepage
/sign-in           -> Clerk SignIn, Google-ready
/sign-up           -> Clerk SignUp, Google-ready
/forgot-password   -> Clerk-backed custom password recovery flow
/login             -> /sign-in compatibility redirect
/signup,/register  -> /sign-up compatibility redirects
/account           -> Tanergy-owned profile editor for display name
/workspaces        -> protected by Clerk when TANGENT_REQUIRE_WEB_AUTH=1
/api/auth/session  -> returns Clerk-backed Tanergy session shape when signed in
/api/auth/profile  -> persists Tanergy-owned profile fields through the Next proxy
shared remote clients -> attach Clerk JWT to /api/v1/auth, /boards, /assets, /image-ops and /ai
```

Current local issue to maintain during deploy:

- Local `/admin` was blocked when Web Auth required Clerk but the browser had no Clerk session; the dev-only `/api/auth/dev-bypass` route now sets `tangent_dev_auth=1` and lets local testing continue.
- This bypass is intentionally disabled in production and must not be used as an acceptance path.
- Staging/prod `/admin` must be verified with a real Clerk login, a matching `NEXT_PUBLIC_API_BASE_URL`, matching API CORS, Alembic migrated to head, and `admin_roles` granted to the actual signed-in local TANGENT user.

Backend:

```text
services/api/tangent_api/auth_provider.py
  verify JWT issuer/audience/signature/expiry
  validate azp against allowed origins
  return provider, provider_subject, email, display_name, avatar_url

services/api/tangent_api/auth_sessions.py
  map Clerk subject -> tangent_user_identities
  upsert/load tangent_users
  preserve Tanergy-edited local display name after profile completion
  ensure default workspace + owner membership
  should also ensure personal_wallet for S3 Collaborate/personal top-ups
  fall back to deterministic ephemeral ids only when DATABASE_URL is absent

request_context.py
  no longer accepts user/workspace headers as authority in required-auth mode
  resolves local user + workspace membership after token verification
  now returns `user_profile_completed` with the authenticated request context
  forwards request IP from `x-forwarded-for` / `x-real-ip` / client host into auth session sync
  still preserves dev fallback when API auth is not required
```

Environment:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
AUTH_PROVIDER=clerk
CLERK_JWKS_URL
CLERK_JWT_ISSUER
CLERK_JWT_AUDIENCE
CLERK_AUTHORIZED_PARTIES
```

Keep provider secrets server-side only. Google OAuth client secret must not be exposed in public env.

## Validation

- [ ] New user registers and lands in `/workspaces`.
- [ ] New user signs in with Google and lands in `/workspaces`.
- [ ] Email-based staging auth flow lands in `/workspaces` and preserves the expected local user mapping.
- [ ] Logout revokes session.
- [x] Session endpoint returns user and memberships.
- [ ] User cannot access workspace without membership.
- [ ] Invalid/expired provider JWT returns 401.
- [ ] Session/workspace selection supports multiple Team memberships without leaking authority across Teams.
- [ ] First verified user has a personal wallet for Collaborate and personal AI usage.
