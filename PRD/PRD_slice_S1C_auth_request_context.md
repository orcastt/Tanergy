# PRD Slice S1C: Auth And Request Context

**Updated**: 2026-05-02
**Status**: After S1A.

## User Value

Users can create accounts, log in, log out and return to their own workspace. Account identity becomes reliable enough for Board permissions, AI usage history and future credits.

## Requirements

- Email OTP or magic-link login.
- Google OAuth signup/login as a first-class P0 Auth path.
- Optional Apple OAuth account contract later.
- Secure server session.
- Default workspace creation.
- Session endpoint for current user and memberships.
- Rate limiting and safe auth errors.

## Provider Decision

Use an Auth provider for P0 rather than building password storage and OAuth from scratch. Clerk is the preferred Next.js path because it gives hosted/modal sign-in, Google OAuth, user profile UI and JWT issuance quickly. Supabase Auth remains an acceptable alternative if the infrastructure decision favors Supabase.

Product behavior should be the same regardless of provider:

- Signed-out users see a clear Google login option.
- Signed-in users see account/avatar controls.
- First login creates or links the local TANGENT user account.
- The app lands users in `/workspaces` after login.
- Users can still be represented in TANGENT tables for Boards, credits, Admin, AI usage and collaboration.

## Flows

Register:

```text
email -> code/magic link -> verify -> user -> default workspace -> session -> /workspaces
```

Google signup/login:

```text
Continue with Google
  -> Google consent through Auth provider
  -> provider JWT
  -> FastAPI verifies token
  -> local user + oauth identity
  -> default workspace if first login
  -> /workspaces
```

Login:

```text
email -> code/magic link -> verify -> session -> /workspaces
```

Logout:

```text
active session -> revoked -> clear cookie -> login screen
```

## Acceptance

- New user can register and land in `/workspaces`.
- New user can use Google login and land in `/workspaces`.
- Existing user can log in and see the same workspace.
- Logout prevents further API access.
- User cannot spoof another workspace through request headers.
- Auth errors do not reveal sensitive account state.
- Expired or invalid provider tokens are rejected with 401.
