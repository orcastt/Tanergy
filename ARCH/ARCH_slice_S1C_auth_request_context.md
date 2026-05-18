# ARCH Slice S1C: Auth And Request Context

**Updated**: 2026-05-18
**Mode**: Architecture slice.
**Status**: Clerk frontend/session bridge plus FastAPI bearer verification first pass are in place. The local Tanergy profile layer now sits on top of Clerk identity with a post-signup onboarding modal, editable `/account` profile form, visible Clerk-backed forgot-password route and a shared hard-delete service for self-delete plus admin delete; logout/session revocation hardening still remains.

## Goal

Replace mock/dev request identity with a real server-side session. S1C makes `user_id` and active workspace authority come from Auth middleware, not frontend headers.

## Auth Model

```text
register/login
  -> email OTP, magic link, or Google OAuth
  -> auth session
  -> HttpOnly secure cookie or bearer token for API clients
  -> request context
  -> workspace membership lookup
```

## Auth Provider Direction

P0 staging should prefer an Auth provider instead of hand-rolling password and OAuth flows. The active path is Clerk for Next.js. Supabase is currently used for managed Postgres only; Supabase Auth is deliberately not part of the active migration so the database cutover does not also change login authority.

Architecture boundary:

```text
Next.js Web
  -> Auth provider SDK and hosted/modal UI
  -> Google OAuth consent
  -> provider-issued JWT
  -> FastAPI Authorization: Bearer <token>
-> auth_provider.py verifies issuer/audience/signature/expiry/azp
-> auth_sessions.py maps provider subject to tangent_users / tangent_user_identities
-> auth/session service ensures default workspace and personal wallet
-> request_context attaches local user/workspace authority to the request
```

The product must stay provider-portable:

- Frontend may use provider UI components such as Clerk `SignInButton` and `UserButton`.
- FastAPI must verify JWTs server-side and never trust frontend user ids.
- Local product identity remains `tangent_users.id`; provider subject ids live in `tangent_oauth_accounts` / `tangent_user_identities`.
- Board, Asset, AI, Admin and Billing code should depend on `ApiRequestContext`, not directly on Clerk or Supabase SDK objects.
- Google OAuth is first-class for signup/login because it reduces friction for international users.

## Required Tables

```text
tangent_users
tangent_user_identities
tangent_email_otps
tangent_auth_sessions
tangent_oauth_accounts
tangent_workspaces
tangent_workspace_members
```

## API Contracts

```text
POST /api/v1/auth/register
POST /api/v1/auth/login/request-code
POST /api/v1/auth/login/verify-code
POST /api/v1/auth/logout
GET  /api/v1/auth/session
PATCH /api/v1/auth/profile
DELETE /api/v1/auth/account
POST /api/v1/auth/session/refresh
GET  /api/v1/auth/oauth/:provider/start
GET  /api/v1/auth/oauth/:provider/callback
```

Provider-backed API variant:

```text
GET /api/v1/auth/session
  Authorization: Bearer <provider_jwt>
  -> verify issuer/audience/signature/expiry
  -> verify authorized party against allowed origins
  -> upsert or load tangent_users
  -> upsert user identity by provider + provider_subject
  -> ensure default workspace + owner membership
  -> return local session/user/workspace payload
```

Current implementation note:

- Clerk is the active provider path for P0.
- Clerk subject mapping currently uses `tangent_user_identities` with `provider='clerk'`.
- `tangent_oauth_accounts` remains available for future direct Google/GitHub/Apple linking or provider portability work.
- If `DATABASE_URL` is absent in local development, FastAPI can still derive deterministic ephemeral ids so auth-required smoke tests do not depend on Postgres bootstrapping.
- Real authenticated session refresh now also persists the latest request IP into `tangent_users.last_ip_address` when Postgres is configured, so later admin/operator views can show last access facts without trusting frontend headers.
- Real authenticated session refresh now preserves a Tanergy-edited local display name once `tangent_users.profile_completed_at` is set, instead of re-overwriting it from Clerk claims on every login.
- Tanergy-owned profile data currently lives directly on `tangent_users` via `display_name` and `profile_completed_at`; the older `gender` column is now dormant and no longer collected in product flows.
- `DELETE /api/v1/auth/account` now runs a shared account-deletion service: owned solo workspaces are deleted, shared-workspace authored Boards/Assets/Snapshots/AiRuns are reassigned to the workspace owner, log-style rows are removed, and deletion is blocked if the user still owns any non-solo Team/Group workspace or is the last active admin owner.

## Security Rules

- Store session token hashes only.
- Session cookie must be `HttpOnly`, `Secure`, `SameSite=Lax` or stricter.
- OTPs store code hash, purpose, expiry and consumed timestamp.
- Login/register/OTP endpoints need rate limits by IP and email.
- OAuth account linking must use provider subject id, not just matching email.
- Google OAuth email is useful for display and initial account matching, but provider subject id is the durable identity key.
- JWT verification must validate issuer, audience, expiration and signature using provider JWKS or official backend SDK.
- Authorization headers are required for FastAPI private APIs once provider Auth is enabled.
- `admin` is not a billing plan. Admin authority comes from `admin_roles`.
- `free/premium/team` is not an Auth role. Product entitlement comes from billing/credits.
- Team purchase creates Team workspace authority through billing/webhook services, not through Auth roles.
- Collaborate Start/Plus is a personal subscription; enforce one active Collaborate subscription per user in billing/entitlement services.

## Request Context Contract

```text
Request
  -> verify session
  -> load user
  -> resolve active workspace membership
  -> attach ApiRequestContext(user_id, workspace_id, role, auth_source, user_profile_completed)
```

Frontend-provided workspace ids are allowed as a selection hint only. The server must reject the request if the session user is not a member of that workspace.
The first-pass authenticated session contract now returns the active workspace plus the full server-validated workspace membership list, including server-returned workspace plan keys where available, so Team/Group switching does not depend on frontend-invented authority.

S3 wallet dependency:

- First verified session should ensure a user-owned personal wallet.
- Team checkout completion, not signup, creates additional Team workspaces and Team wallets.
- Users may own multiple Team workspaces, so active workspace selection must be explicit and server-validated.
- Group/Collaborate workspaces can share Boards, but their AI payer remains the actor's personal wallet.

Current first-pass behavior:

- When `TANGENT_REQUIRE_API_AUTH=1`, `x-tangent-user-id` and `x-tangent-workspace-id` are no longer authority.
- Bearer token or `__session` cookie becomes the only accepted identity source.
- Authenticated request context now resolves request IP from `x-forwarded-for`, `x-real-ip` or the request client host before syncing the local user row.
- When `TANGENT_REQUIRE_API_AUTH=0`, dev headers/local fallback still work for fast canvas iteration.

## Middleware

- Auth required middleware for Board/Asset/AI private APIs.
- Optional auth middleware for public/share routes.
- Provider JWT verification dependency for Clerk/Supabase-issued tokens.
- Rate limiting middleware for auth and expensive write endpoints.
- Request log middleware with request id, user id, route, status, latency.
- Uniform error envelope.

## Next.js Integration Notes

For Clerk-first implementation:

```text
apps/web
  install @clerk/nextjs
  wrap app layout with ClerkProvider
  show SignInButton when signed out
  show UserButton when signed in
  attach provider JWT to FastAPI requests
```

Current first-pass web routes:

```text
/                  public Tanergy homepage
/sign-in           Clerk SignIn
/sign-up           Clerk SignUp
/forgot-password   Clerk-backed custom recovery flow
/login             compatibility redirect to /sign-in
/signup,/register  compatibility redirects to /sign-up
/account           Tanergy-owned profile editor for display name
/workspaces        protected by Clerk proxy when TANGENT_REQUIRE_WEB_AUTH=1
/api/auth/session  Clerk-backed Tanergy session bridge, dev fallback only when auth is not required
/api/auth/profile  Clerk-authenticated proxy to FastAPI profile writes
/api/auth/account  Clerk-authenticated proxy to FastAPI account deletion
remote Board/Asset/AI/Image-Op clients  attach Clerk JWT in browser fetches
```

Profile ownership split:

- Clerk owns authentication, password reset, email verification and provider subject identity.
- Tanergy owns editable profile fields that need to appear in boards, workspaces, billing surfaces and future product preferences.
- The post-signup onboarding gate is enforced in the frontend using the server-returned `profileCompleted` session field, but persistence stays server-side through `/api/v1/auth/profile`.
- Account deletion crosses both layers: Tanergy deletes local user/workspace data, while Clerk deletes the external auth user by `provider_subject`. This path now requires `CLERK_SECRET_KEY` on the API runtime even though JWT verification still uses issuer/JWKS/audience.

Local development exception:

- `/api/auth/dev-bypass` may set a `tangent_dev_auth` cookie only when `NODE_ENV !== production`.
- The proxy bypass exists only to unblock local admin/product testing when Clerk browser state or localhost/127.0.0.1 origins are not aligned.
- Staging and production acceptance must use real Clerk sessions and FastAPI bearer verification.
- `/admin` access still requires `admin_roles`; after each fresh database or migration reset, bootstrap or grant a real signed-in operator before running admin smoke.
- Staging/prod `/admin` smoke must use a real provider JWT for the signed-in operator, never the local dev-bypass cookie.

Expected frontend env:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_API_BASE_URL
```

FastAPI needs server-only config for JWT verification:

```text
AUTH_PROVIDER=clerk
CLERK_JWKS_URL
CLERK_JWT_ISSUER
CLERK_JWT_AUDIENCE
CLERK_AUTHORIZED_PARTIES
```

FastAPI now also needs:

```text
CLERK_SECRET_KEY
```

Do not put `CLERK_SECRET_KEY` or Google client secrets in public frontend variables.

## Acceptance

- New user can register and verify/login.
- New user can sign up/login with Google OAuth.
- New user receives a default workspace and owner membership.
- New user receives a personal wallet for Solo/Collaborate billing.
- Signed-in user can delete their own account when they no longer own a Team or Group workspace.
- Logout revokes the active session.
- Session endpoint returns user plus workspace memberships.
- User cannot spoof `user_id` or `workspace_id` through headers.
- Real signed-in admin can load `/admin` after an audited `admin_roles` bootstrap/grant.
- Production-like Web/API origins pass CORS and Clerk authorized-party checks.
- Rate limit and invalid OTP behavior are tested.
- Invalid, expired or wrong-audience provider JWT returns 401.
