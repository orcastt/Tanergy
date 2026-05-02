# ARCH Slice S1C: Auth And Request Context

**Updated**: 2026-05-02
**Mode**: Architecture slice.
**Status**: After S1A.

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

P0 staging should prefer an Auth provider instead of hand-rolling password and OAuth flows. The current recommended path is Clerk for Next.js, with Supabase Auth as an acceptable fallback if the product chooses to consolidate Auth and Postgres around Supabase.

Architecture boundary:

```text
Next.js Web
  -> Auth provider SDK and hosted/modal UI
  -> Google OAuth consent
  -> provider-issued JWT
  -> FastAPI Authorization: Bearer <token>
  -> backend verifies token and maps provider subject to tangent_users
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
POST /api/v1/auth/session/refresh
GET  /api/v1/auth/oauth/:provider/start
GET  /api/v1/auth/oauth/:provider/callback
```

Provider-backed API variant:

```text
GET /api/v1/auth/session
  Authorization: Bearer <provider_jwt>
  -> verify issuer/audience/signature/expiry
  -> upsert or load tangent_users
  -> upsert oauth identity by provider + provider_subject
  -> ensure default workspace + owner membership
  -> return local session/user/workspace payload
```

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

## Request Context Contract

```text
Request
  -> verify session
  -> load user
  -> resolve active workspace membership
  -> attach ApiRequestContext(user_id, workspace_id, role, auth_source)
```

Frontend-provided workspace ids are allowed as a selection hint only. The server must reject the request if the session user is not a member of that workspace.

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
```

Do not put `CLERK_SECRET_KEY` or Google client secrets in public frontend variables.

## Acceptance

- New user can register and verify/login.
- New user can sign up/login with Google OAuth.
- New user receives a default workspace and owner membership.
- Logout revokes the active session.
- Session endpoint returns user plus workspace memberships.
- User cannot spoof `user_id` or `workspace_id` through headers.
- Rate limit and invalid OTP behavior are tested.
- Invalid, expired or wrong-audience provider JWT returns 401.
