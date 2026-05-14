# S1C Auth/Admin Production Boundary Plan

**Created**: 2026-05-08
**Updated**: 2026-05-14
**Status**: Active tactical plan.
**Owner slice**: S1C, with S1B/S1D/S3 dependencies.

## Goal

Make staging and production admin access depend on real provider identity and server-owned local authority, not local dev-bypass cookies or spoofable headers.

Target boundary:

```text
Clerk login
  -> provider JWT
  -> FastAPI verifies issuer/audience/signature/expiry/authorized party
  -> local tangent user + identity mapping
  -> default solo workspace + owner membership + personal wallet
  -> admin_roles grants operator access
  -> /admin uses server-gated APIs with audited reads/writes
```

## Scope

- Real-login admin access without local dev-bypass.
- Admin operator bootstrap/grant path for the actual signed-in local TANGENT user.
- Spoof tests for user/workspace headers in required-auth mode.
- Production-like Web/API origin and CORS contract.
- First verified session ensures default solo workspace and personal wallet.

Current implementation checkpoint:

- [x] First verified Postgres session now ensures a personal `credit_accounts` wallet.
- [x] Bearer-mode `/api/v1/auth/session` ignores spoofed `x-tangent-user-id`.
- [x] Clerk authorized-party validation now fails if configured origins exist and JWT `azp` is missing or mismatched.
- [x] `s3_admin_bootstrap.py` can grant `admin_roles` by local user id or login email after first real login.
- [x] Authenticated `/api/v1/auth/session` now returns the full validated workspace membership list and server-side workspace plan facts.
- [x] Remote smoke helper exists: `services/api/scripts/s1c_remote_admin_smoke.py`.
- [x] Remote real-login admin smoke now passes on staging for session/admin/operator/finance/AI-route reads.
- [ ] Google/email flow verification and broader signed-in browser acceptance still remain.

Current execution note:

- This plan is now past the basic reachability gate together with S1B staging smoke.
- The current follow-through is broader signed-in browser acceptance plus Google/email/logout verification, not dev-bypass recovery.

Out of scope for this cut:

- Native OTP/password flows.
- Full payment automation.
- Deep Team/Group governance beyond preserving membership authority.
- AI provider-route production execution.

## Phase 1: Auth Session Closure

- Confirm Clerk bearer token is the only private API identity source when `TANGENT_REQUIRE_API_AUTH=1`.
- Ensure provider subject maps to stable `tangent_users` and `tangent_user_identities`.
- Ensure first verified session creates:
  - default `solo_workspace`
  - owner `workspace_members` row
  - personal `credit_accounts` wallet
- Keep deterministic/dev identity fallback only when API auth is not required.

Exit criteria:

- A new real signed-in user has a local user, solo workspace and personal wallet.
- Repeat login maps to the same local user.
- Header spoofing cannot replace the authenticated user or workspace.

## Phase 2: Admin Operator Bootstrap

- Add or harden a one-off server-side bootstrap path that grants `admin_roles` to a known signed-in local TANGENT user.
- Keep admin writes audited.
- Prevent local dev-bypass from being an acceptance path for staging/prod admin.

Exit criteria:

- A signed-in real operator can be granted admin once.
- `/api/v1/admin/me` returns admin access for that operator.
- A non-admin real user cannot access admin APIs.

## Phase 3: Origin And CORS Contract

- Document and enforce Web origin, API origin and Clerk authorized-party settings.
- Confirm local `localhost`/`127.0.0.1` behavior stays dev-only and does not leak to production.
- Add smoke commands for local and staging admin fetches.

Exit criteria:

- Browser calls from the configured Web origin can reach FastAPI admin APIs.
- Wrong origins or wrong-audience tokens fail cleanly.
- The deploy runbook lists required env vars and smoke commands.

## Phase 4: Tests And Smoke

Automated tests:

- required-auth mode rejects spoofed `x-tangent-user-id`.
- required-auth mode rejects non-member workspace selection.
- invalid/wrong-audience/expired provider JWT returns 401 where practical in local tests.
- first-session personal wallet creation is covered.
- admin APIs require `admin_roles`.

Manual smoke:

1. Sign in with a real Clerk user.
2. Call `/api/v1/auth/session` and confirm local user/workspace/wallet facts.
3. Bootstrap/grant admin role to that local user.
4. Open `/admin` without dev-bypass and confirm directory, finance and AI route panels load.
5. Sign in as a non-admin and confirm `/admin` is denied.

2026-05-14 checkpoint:

- Real staging smoke now returns green for `/api/auth/session`, `/api/admin-proxy/me`, `/api/admin-proxy/operator/users?limit=3`, `/api/admin-proxy/finance/summary` and `/api/admin-proxy/ai/route-metrics?limit=5`.

## Dependencies

- S1B: staging Web/API URL, CORS and Clerk env alignment.
- S1D: workspace membership authority for Board and workspace APIs.
- S3: personal wallet and `admin_roles` tables/migrations.
