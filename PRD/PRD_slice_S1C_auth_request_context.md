# PRD Slice S1C: Auth And Request Context

**Updated**: 2026-05-15
**Status**: Clerk frontend/session bridge, FastAPI bearer verification, Tanergy-owned profile onboarding/editing and a visible Clerk-backed forgot-password flow are landed; logout/session hardening remains.

## User Value

Users can create accounts, log in, log out and return to their own workspace. Account identity becomes reliable enough for Board permissions, AI usage history and future credits.

## Requirements

- Email OTP or magic-link login.
- Google OAuth signup/login as a first-class P0 Auth path.
- Optional Apple OAuth account contract later.
- Secure server session.
- Default workspace creation.
- Personal wallet creation on first verified local user session.
- Session endpoint for current user and memberships.
- Tanergy-owned profile completion after first real sign-in.
- Editable display name and gender on the Account surface.
- Visible forgot-password entry that runs Clerk recovery instead of a mock redirect.
- Active workspace selection for users who own or join multiple Teams/Groups.
- Rate limiting and safe auth errors.

## Current First Pass

- Public landing, Clerk `/sign-in` and `/sign-up` routes exist.
- Compatibility login/signup/register routes redirect to the Clerk routes.
- `/forgot-password` now exposes a real Clerk-backed recovery flow instead of bouncing back to `/sign-in`.
- Frontend remote clients can attach the Clerk JWT to Board, Asset, Image Op and AI API calls.
- FastAPI can verify provider-issued bearer tokens and map Clerk subjects to local `tangent_users` / `tangent_user_identities`.
- A default workspace is ensured on first verified session.
- A personal wallet should be ensured on first verified session so Collaborate and personal top-ups have a payer account.
- First verified session now stays blocked behind a profile-completion modal until Tanergy has saved the local display name/profile fields.
- `/account` now edits Tanergy-owned profile fields while making clear that password/email verification still belong to Clerk.
- Required-auth mode no longer trusts `x-tangent-user-id` or `x-tangent-workspace-id` as authority.

Remaining hardening:

- Email OTP/magic-link product path.
- Logout/session revocation and token-hash lifecycle.
- Full invalid/expired/wrong-audience JWT test matrix.
- Multi-workspace selection and membership matrix.
- Team checkout-created workspaces and Group workspace selection.
- One active Collaborate subscription per user at checkout/session entitlement time.
- Auth route rate limiting and request logging.

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
- First real sign-in prompts for Tanergy profile completion before normal workspace use.
- Signed-in user can edit display name and gender later from `/account`.
- Sign-in surface exposes a visible forgot-password path and Clerk completes the reset flow.
- Logout prevents further API access.
- User cannot spoof another workspace through request headers.
- Auth errors do not reveal sensitive account state.
- Expired or invalid provider tokens are rejected with 401.
