# Project State Slice S1C: Auth And Request Context

**Updated**: 2026-05-02
**Status**: After S1A.

## Objective

Replace dev headers/mock identity with real server-side sessions and workspace membership lookup.

## Work Items

- [ ] Auth API contracts.
- [ ] Choose Auth provider for S1C implementation: Clerk preferred, Supabase Auth acceptable fallback.
- [ ] Add Google OAuth signup/login flow.
- [ ] Add Next.js provider shell: provider wrapper, signed-in/signed-out UI and account/avatar control.
- [ ] Attach provider JWT to FastAPI requests.
- [ ] Add FastAPI JWT verification dependency for provider-issued tokens.
- [ ] Map provider subject ids to local `tangent_users` and `tangent_oauth_accounts`.
- [ ] Session token hashing and revocation.
- [ ] Email OTP issue/verify flow.
- [ ] Default workspace creation.
- [ ] Request context middleware.
- [ ] Rate limit and request logging for auth routes.
- [ ] Tests for spoofed workspace/user ids.
- [ ] Tests for invalid, expired and wrong-audience provider JWTs.

## Clerk-First Implementation Notes

Frontend:

```text
npm -C apps/web install @clerk/nextjs
apps/web/src/app/layout.tsx -> ClerkProvider
header/account entry -> SignInButton / UserButton
API client -> Authorization: Bearer <Clerk JWT>
```

Backend:

```text
services/api/tangent_api/auth_provider.py
  verify JWT issuer/audience/signature/expiry
  return provider, provider_subject, email, display_name, avatar_url

request_context.py
  no longer accepts user/workspace headers as authority in required-auth mode
  resolves local user + workspace membership after token verification
```

Environment:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
AUTH_PROVIDER=clerk
CLERK_JWKS_URL
CLERK_JWT_ISSUER
CLERK_JWT_AUDIENCE
```

Keep provider secrets server-side only. Google OAuth client secret must not be exposed in public env.

## Validation

- [ ] New user registers and lands in `/workspaces`.
- [ ] New user signs in with Google and lands in `/workspaces`.
- [ ] Logout revokes session.
- [ ] Session endpoint returns user and memberships.
- [ ] User cannot access workspace without membership.
- [ ] Invalid/expired provider JWT returns 401.
