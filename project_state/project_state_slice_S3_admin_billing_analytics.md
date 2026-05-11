# Project State Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-11
**Status**: Active pivot slice. Admin, ledger, usage, seat, checkout and AI-control-plane scaffolds exist. Phase 1/2/3 development has started: migration `20260508_0012` adds Team/Group wallet schema facts, migration `20260508_0013` widens workspace roles for `admin/editor/viewer`, the first payer resolver cut now makes Team workspaces charge a Team wallet while Group/Collaborate workspaces charge the actor personal wallet, Team purchase can provision a Team workspace and Team wallet, and Collaborate purchase can activate the user's single personal Collaborate subscription.

## Current Truth

Reusable first-pass work:

- `/admin` is server-gated, reads summary/users/workspaces/boards/audit facts, exposes finance reconciliation panels and supports audited owner-only admin role changes.
- `/admin` AI panels can inspect/edit model, provider-route and pricing facts, with versioned publish/rollback.
- `/billing`, `/team` and `/usage` first-pass screens exist.
- Backend billing/entitlement reads exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Team seat list/upsert/revoke and workspace member-role mutation exist for the current workspace.
- `credit_accounts`, `credit_ledger`, preflight reads and internal grant/top-up/usage/refund/admin-adjustment helpers exist.
- Payment checkout/complete scaffolds exist for top-ups and seat capacity. Non-manual checkout responses can now expose a hosted checkout URL with amount/currency/kind/client-reference handoff metadata, missing hosted checkout configuration fails before payment creation, and hosted-provider payments cannot be manually completed. The payment layer is provider-neutral, so `manual_test` and generic hosted checkout can keep staging moving while Stripe is unavailable. The optional Stripe checkout adapter first cut requires `TANGENT_STRIPE_SECRET_KEY` only when `stripe` is selected, creates Checkout Sessions through Stripe's server API and labels `checkout.adapter=stripe_checkout` without reading local secret files. A signed provider webhook inbox records provider events and routes successful checkout events through the same completion/grant path by internal payment id, client reference or provider metadata checkout session id, but provider-specific signatures and invoice/refund reconciliation are not production-complete.
- AiRun quote/preflight/lifecycle, model-route-pricing facts, provider-cost facts and attempt-level admin runtime views exist.
- The canvas GeekAI fast path proves UX for image generation/edit/reference, analysis, chat and prompt optimization, but is not yet the production control-plane path.
- Migration `20260508_0012_team_group_wallet_contracts` now adds account kind, subscription ownership/family/seat capacity, one-active Collaborate and one-active Team workspace subscription indexes, workspace invite token facts and `team_wallet` charge scope.
- `workspace_entitlements` now resolves Team charge summaries to `chargedScope=team_wallet`, `entitlementSource=team_wallet` and the workspace-owned Team wallet account. Group/Collaborate remains `actor_personal`.
- Team seat assignment now derives included credits from the active Team subscription and does not create duplicate credit grants; Team subscription and seat-purchase completion remain the paths that grant included credits into the Team wallet.
- Team seat checkout completion now writes Team subscription ownership/seat-capacity facts and grants included credits into the Team wallet.
- `/api/v1/billing/teams/checkout` now creates a pending Team subscription payment from a personal context; completing that payment provisions the new `team_workspace`, owner membership, workspace-owned Team wallet, Team subscription, seat capacity and first included-credit grant.
- `/api/v1/billing/workspaces/current/topups/checkout` now creates a Team wallet top-up payment for the current Team workspace; completion writes `topup_purchase` into the workspace-owned Team wallet ledger.
- `/api/v1/billing/topups/checkout` remains the personal-wallet top-up path; completion writes `topup_purchase` into the acting user's personal wallet.
- `/api/v1/billing/collaborate/checkout` now creates a personal Collaborate subscription payment; completing it upserts the user's single active `collaborate_start`/`collaborate_plus` subscription and grants included credits to the personal wallet.
- `/api/v1/billing/webhooks/{provider}` now verifies `TANGENT_PAYMENT_WEBHOOK_SECRET` HMAC signatures, records `tangent_webhook_events`, completes supported checkout success events through the shared payment completion path by payment id, client reference or provider metadata, and returns duplicate provider events without double-granting credits.
- `/api/v1/admin/finance/*` now exposes server-gated summary, payment, wallet, subscription, credit ledger and Team member usage read APIs, with matching frontend panels and audit events for finance/admin/owner/analyst roles.
- `/api/v1/admin/finance/plan-catalog` plus public `GET /api/v1/billing/plans` now expose the editable subscription catalog. The Finance tab has been repurposed from a reconciliation-heavy surface into stacked per-plan editor cards, and backend billing/entitlement reads now consume catalog values for included credits, prices, registration credits, board/page caps and Group/Team limits.
- `/api/v1/admin/finance/manual/*` now provides audited owner/admin/finance write operations for Stripe-unavailable operations: top up or deduct a user personal wallet, top up or deduct a Team wallet, create a Team with plan/seats/credits, create a Group workspace, cancel/delete subscriptions and delete Team/Group workspaces. The new `group-plan-operation` and `team-plan-operation` contracts now cover `assign`, `renew`, `upgrade`, `delete`, `freeze` and `unfreeze`, return the fields the operator modals need, require an operation reason and drive plan dates by `effectMode` plus `durationCount * durationUnitDays` instead of a date picker.
- New-user session bootstrap now grants the free-plan registration credit from the plan catalog. Current local default is `free_canvas.registration_credits = 50`.
- `/api/v1/admin/directory/*` now exposes server-gated user, Team and Group directory aggregates plus workspace member/board detail. `/api/v1/admin/ai/route-metrics` now summarizes provider route calls, user credits charged, provider cost, failures and latency.
- `/admin` has been reorganized into Overview, Users, Teams, Groups, AI API Routes, Finance and Access tabs. Users show wallet balance, total spend, Team spend, Group/personal spend and focused Collaborate/Group, Team-create, top-up and deduct controls. Team/Group detail shows current plan, expiry, wallet, usage and delete/change actions. AI API Routes separates image/text route usage before the model/route/pricing control plane.
- Admin Teams/Groups detail now renders as a full-width operator panel with row-style summary stats, full-width action strip and side-by-side member/board tables on desktop. The AI API Routes editor has also been realigned so inventory and selected-route detail share the wide desktop row while the lower route-metrics and API-call ledger remain full-width bands.
- Admin operator console redesign is now in first-pass implementation. `/api/v1/admin/operator/users` and `/api/v1/admin/operator/users/{user_id}` provide the operator read model for paginated User inventory and one-call user detail bundles. `/admin?tab=users` now renders the inventory table from that model, and `/admin/users/[userId]` now renders Billing, Team Plan, Joined Team, Group Plan and Joined Group tabs from the operator bundle instead of composing slow per-panel directory calls.
- Admin console shell now does access-only server bootstrap, then hydrates Users/Teams/Groups/AI/Finance from client cache or live reads. User inventory snapshots are persisted locally, hover/focus on Detail now warms the user-detail bundle, and `/admin/users/[userId]` can reopen from cached detail instead of blocking first paint on another server bundle fetch.
- Current admin modal bridge started on 2026-05-09: user detail can open centered modals for existing audited manual finance operations including personal top-up/deduct, Team wallet top-up/deduct, Team plan assignment, Team creation, Group creation, Collaborate plan assignment, subscription cancel and workspace delete. Native operator writes now cover user block/unblock/delete, subscription freeze/unfreeze and joined workspace role/remove actions.
- Operator access facts moved forward on 2026-05-10: authenticated session sync now writes `tangent_users.last_ip_address`, operator inventory/detail derive registration state from real auth facts, and subscription freeze/unfreeze now persists `paused_at`, `paused_by`, `pause_reason` while preserving remaining period time on resume.
- Manual plan-operation checkpoint moved forward on 2026-05-10: upgrade grants now use included-credit delta instead of blindly regranting the full target pack, paused subscriptions stay in current-plan inventory/detail rows, and targeted backend tests cover Team/Group assign-renew-upgrade-delete-freeze-unfreeze behavior.
- Operator detail wiring moved forward on 2026-05-10: `/admin/users/[userId]` Team Plan and Group Plan modals now call the new `team-plan-operation` and `group-plan-operation` contracts for renew/upgrade/delete/freeze/unfreeze flows, while Team seat-buy stays on the same upgrade contract with seat-capacity delta grant semantics.
- Frontend alignment moved forward on 2026-05-10: owned Team plans and created Groups now render in dedicated dense operator tables instead of the generic workspace table, and the plan modals now expose current-plan summary, action-choice controls and grant-credit preview pills on top of the new plan-operation contracts.
- Operator detail density moved forward again on 2026-05-10: owned Team and Group rows now expose inline member delete/change-role actions inside the row stacks, Team rows show seat-capacity counters directly in the member column, and Group Plan is now presented as one consolidated panel with current-plan rows plus created-group inventory instead of split generic panels.
- Operator workspace-action bridge moved forward on 2026-05-10: admin operator now has arbitrary-workspace invite list/create/revoke routes, direct workspace-member add routes, and workspace-scoped board copy/delete routes. Owned Team/Group rows now wire `Invite` and `Add member` through centered modals, while board rows now expose native `Copy` / `Delete` admin actions instead of read-only labels.
- Operator detail row state moved forward again on 2026-05-10: pending workspace invitations are now hydrated into the Team/Group detail bundle itself, rendered inline under the member stack and revocable from the row. The detail cache can now patch invite/member/board mutations locally, so those row actions no longer need a full detail refetch just to reflect the visible change.
- Operator detail mock-alignment moved forward again on 2026-05-10: Billing history now follows the tighter Item/Amount/Credit/Date/Reason table shape, Invite/Add member moved into the member column stacks for owned and joined Team/Group rows, and Group Plan now renders the current plan in the same table pass as created Groups with past-plan history below it.
- Operator join-workspace flow moved forward on 2026-05-10: Joined Team and Joined Group tabs now expose real `Join Team` / `Join Group` modals backed by searchable admin workspace-directory lookups plus the native workspace-member-add contract. When that action succeeds, the detail cache can append the newly joined row locally from the selected workspace lookup instead of forcing a full detail refetch.
- Admin console loading moved forward again on 2026-05-10: `/admin` now server-bootstraps admin access plus the active-tab seed bundle, `/admin/users/[userId]` now server-seeds the operator detail bundle, and the top-level tabs background-warm after idle so later Users/Teams/Groups/AI/Finance/Access switches stay client-hot instead of route-blocking.
- Team/Group inventory scalability moved forward on 2026-05-10: `/api/v1/admin/directory/workspaces` now returns `limit`, `offset` and `totalCount`, and the top-level Teams/Groups dashboards now use server-side search/pagination instead of loading a fixed list and filtering locally.
- AI API Routes alignment moved forward on 2026-05-10: the top-level AI admin page now uses the same dense management language as Users/Teams/Groups. Route management is table-first with kind tabs, toolbar search/filters, row selection and a dedicated detail form panel; route consumption remains split by image/text/video tables and the lower runtime section now behaves as a full-width grouped run ledger on the same live admin AI resources.
- AI route detail reads moved forward again on 2026-05-10: `/api/v1/admin/ai/api-calls` and `/api/v1/admin/ai/runs` now accept `routeId`, selected-route runtime tables reload from route-aware backend filters instead of client-side slicing global samples, route-id first matching still keeps a route-key/provider fallback for older rows missing `route_id`, and the route detail panel now exposes route-scoped version history, publish/rollback actions with optional audit notes, recent run history, and selected-run attempt drilldown across failover routes.
- AI route runtime ledger moved forward on 2026-05-10: the bottom `API Calls` section now groups rows by `runId` instead of showing raw attempt rows, summarizes run final status beside selected-route hit counts/credits/cost, expands inline to inspect full failover attempt history, and shares the same selected-route highlighting used by the route detail drilldown.
- AI route local-first pass moved forward again on 2026-05-10: the recent-runs table and lower grouped ledger now share one selected-run state, and the route detail panel now exposes a denser runtime summary for direct wins, fallback-away wins, terminal failures, attempts-per-run and last route hit. The remaining work is now mostly in remote/prod-like gates rather than local UI plumbing: staging redeploy, real-login smoke and higher-volume verification.
- AI route health moved forward again on 2026-05-10: `/api/v1/admin/ai/route-metrics` now computes long-window route-hit runs, direct wins, fallback wins, terminal failures, average attempts per run, direct win rate and route-attempt success rate on the server. The dense route inventory/detail/metrics tables now render those backend facts directly, so the remaining work is mostly staging redeploy, real-login smoke and higher-volume verification instead of more local health derivation.
- Operator detail alignment moved forward on 2026-05-11: User inventory/detail table cells now preserve real table-cell layout instead of grid-rendering table cells, so Account profile columns align with the Admin_user_inventory reference; the local billing fallback now also resolves Team workspaces to `team_wallet` with workspace-owned credit accounts, matching the server S3 payer contract.
- Operator acceptance moved forward on 2026-05-11: the admin operator console now matches the reference inventory/detail shape much more closely, including billing target selection for personal vs owned Team wallets, register-state display, block/unblock action, joined-Team stacked credit bars, role-gated joined Team/Group actions, Group freeze/unfreeze entry points, and Team/Group plan table width protection. Targeted S3 backend tests and full local lint/typecheck/build/pytest gates are green.
- `/api/v1/workspaces/groups` now creates a `group_workspace` and owner membership, gated by an active personal Collaborate subscription.
- `/api/v1/workspaces/current/invitations` and `/api/v1/workspaces/invitations/{token}/accept` now provide backend invite link create/list/accept/revoke and expiry contracts. Tokens are stored as hashes, accepted invites create/update workspace membership with `admin/editor/viewer` roles, and Team invite accept enforces active subscription seat capacity before creating a seat assignment.
- `DELETE /api/v1/workspaces/current/members/{user_id}` now removes workspace members; for Team workspaces it also revokes active seat assignments.
- Frontend first-pass wiring now exposes billing plan checkout/complete, Team create/purchase, Group create, invite accept, invite create/revoke, role-gated member removal, role update, Team seat assignment, `/usage` Team top-up, Team seat checkout, personal top-up and Group create actions. Team/Group dashboards load the server workspace dashboard when available. Hosted checkout redirects and `/billing/success` plus `/billing/cancel` return routes exist; final wallet/subscription state still depends on provider webhook completion.
- Backend AI run settlement contract tests now cover both Group/Collaborate actor-personal charging and Team workspace Team-wallet charging, and polling/cancel requests preserve the original run charge context.
- Disposable Postgres smoke passed on 2026-05-08: empty DB and P0-seeded DB migrate to head; Team checkout creates a Team workspace/wallet, invite accept works, Team quote/run settlement resolves and charges `team_wallet`, member removal works; Collaborate checkout creates a Group, Group invite accept works and Group quote/run settlement resolves and charges `actor_personal`.
- Local admin/payment smoke passed on 2026-05-08: `/admin` loaded the finance panel against a disposable Postgres-backed API and every admin finance read returned 200; manual admin top-up/plan/cancel contracts write payment, subscription, ledger and audit facts; manual-test Team wallet top-up completed into the Team wallet ledger; manual-test Team seat checkout completed and allowed a Team seat assignment; hosted checkout returned a `hosted_redirect` URL and rejected manual completion with the expected webhook-only 409.
- Manual admin contract checkpoint passed on 2026-05-09: targeted tests cover top-up, credit deduction, plan assignment, subscription cancel, workspace create/delete, required operation reason and admin-role enforcement.
- Deterministic local acceptance checkpoint passed on 2026-05-11: backend tests now clear repo `.env` runtime overrides through `services/api/tests/conftest.py`, fixing ambient-driver leakage across AI, board and asset contract tests. Full `services/api/tests` is green again locally.
- Remote staging smoke is still blocked by environment state as of 2026-05-10 22:45 UTC: `https://api-staging.tanergy.cc/health` and `https://api-staging.tanergy.cc/api/v1/admin/me` both timed out against `5.78.122.74`, while `https://staging.tanergy.cc/admin` returned a Vercel `404`. Local remote-smoke tooling now also probes operator users, finance summary and AI route metrics once the staging API host is reachable again.
- Local admin access issue recorded on 2026-05-08: local Web Auth can require Clerk even when the operator is only trying to test admin finance locally. The current local fix is a dev-only `/api/auth/dev-bypass` cookie plus API on `127.0.0.1:8100`, Alembic upgraded to head and `dev-user` granted `admin_roles.owner`. For staging/prod this must be replaced by real Clerk login, matching Web/API origins, migrated DB schema and admin role grant for the actual signed-in user.

## Product Rule Drift

The older S3 plan assumed Team Start/Growth charged the acting member's own seat-backed account. That is now superseded.

New rule:

- Team purchase creates an isolated Team workspace and Team wallet.
- Team seats add capacity and included credits to the Team wallet.
- Team top-ups credit the Team wallet.
- Team AI runs charge the Team wallet.
- One user may buy/own multiple Teams.
- Collaborate Start/Plus are personal subscriptions; one user may have only one active Collaborate subscription.
- Group workspace Boards are shared, but AI spend charges the acting user's personal wallet.

## What Must Be Redone Or Hardened

1. Payer resolver: Team workspace runs must resolve to a workspace-owned Team wallet. First cut implemented for entitlement/quote.
2. Subscription model: Team subscriptions must be workspace-owned; Collaborate subscriptions must be user-owned and single-active per user. Backend checkout/upsert first cut implemented.
3. Seat lifecycle: seat capacity/member assignment must not imply per-member credit ownership. Seat grant first cut now writes Team wallet.
4. Wallet grants: Team plan grants and top-ups write to the Team wallet; Collaborate grants/top-ups write to personal wallet. Backend Team subscription, seat and top-up grants now write Team wallet; hosted checkout response metadata and signed webhook authority first cuts now exist.
5. Workspace purchase flow: backend contract first cut implemented for Team checkout completion; frontend action wiring, hosted checkout response contract, provider-neutral checkout adapter, Stripe Checkout Session first cut, signed webhook inbox with provider metadata lookup, disposable Postgres smoke and local manual/hosted payment smoke now exist; deployed staging smoke remains.
6. Invite and member lifecycle: backend Team/Group invite create/accept/revoke/expiry, Team seat-capacity-on-accept, role assignment and member removal first cut implemented; frontend action wiring now includes invite/revoke/remove/role-update/seat-assign with owner/admin gating, while email sending and board-specific assignment UI remain.
7. Permission services: Board roles, workspace roles, Team billing visibility and AI payer eligibility must stay separate.
8. Admin monitoring: every production AiRun must be queryable by user, team/workspace, board, node, model, route, pricing rule, charged account and provider cost. Finance first pass now also surfaces payments, wallets, subscriptions, credit ledger and Team member usage, and the developer console now separates user, Team, Group, AI route, finance and access views.
9. GeekAI reconciliation: local Next routes must become thin/product-proof paths behind server AiRun or be marked development-only.
10. Admin operator UI/read model: paginated User inventory, paginated Team/Group inventory and single user-detail bundle first pass now exist. User status writes, subscription freeze/unfreeze, inline pending invite rows, joined Team/Group role/remove actions and unified payment-ledger-subscription-audit billing history are now in. Local/demo-rich QA can now be seeded by `services/api/scripts/seed_admin_operator_demo.py`; higher-volume indexing and staging-facing operator smoke still remain.

## Current Active Slice

```text
S3 Team/Group Wallets + Membership/Billing
  depends on S1A schema delta
  depends on S1C registration/workspace selection hardening
  depends on S1D permission and invite hardening
  depends on S2 payer resolver + provider-route settlement
```

The implementation checklist now lives in:

```text
dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md
```

## Validation Target For Next Checkpoint

- A new Team checkout can create an isolated Team workspace and Team wallet in backend contract tests and disposable Postgres smoke; hosted staging smoke remains.
- A Team owner can create invite links, accept/revoke/expire invites with seat-capacity enforcement, assign role, remove member with seat revoke, and add seats; frontend first-pass wiring, owner/admin role gating and disposable Postgres smoke exist, while email/deployed staging smoke remain.
- Developer admin can now create or revoke invites for arbitrary Team/Group workspaces, directly add members into those workspaces, and copy/delete boards from the operator detail tables without switching into the end-user workspace shell.
- The same operator detail bundle can now repaint invite/member/board row mutations locally from returned payloads, so the visible Team/Group tables stay hot after those actions.
- A Team AI quote resolves `charged_account_id` to the Team wallet. Covered by backend tests.
- A Group AI quote resolves `charged_account_id` to the actor's personal wallet. Covered by backend tests.
- Team and Group mock AI run settlement writes usage charges to the resolved account. Covered by backend contract tests and disposable Postgres run-settlement smoke; hosted live-provider smoke still remains for the next staging checkpoint.
- A user cannot activate both Collaborate Start and Collaborate Plus at the same time. Backend checkout upserts the single active subscription and migration keeps the DB constraint.
- Admin runtime views can filter a run by user, workspace/team, board, model, route and charged account; admin finance views can reconcile payment, wallet, subscription, ledger and Team member usage facts.
- Admin directory views can navigate from registered users to owned Team/Group workspaces, inspect Team/Group member and board detail, see wallet/spend/usage facts, and enter the relevant manual billing operation while Stripe remains unavailable.
- Admin operator redesign acceptance now requires local visual smoke against the new seedable demo dataset plus billing-history reconciliation after modal writes.

## Not Production-Complete

- Provider-specific signatures, deployed staging payment smoke, invoices, refunds and production reconciliation.
- Production admin access runbook: migrate DB to head, configure Web/API origins, validate real Clerk JWT, grant/verify `admin_roles`, then smoke `/admin/me` and `/admin/finance/summary` with the signed-in operator.
- Subscription renewal automation and provider-driven cancellation automation; manual admin cancellation exists only as an operations bridge.
- Production-grade seat proration and downgrade policy.
- Deeper admin finance views for invoices, refunds, provider health and revenue rollups.
- Admin operator remaining depth: higher-volume indexing, richer registration-state taxonomy if invite-prelogin users arrive, and production visual QA data.
- Provider refund/cancel reconciliation across all live providers.
- Enterprise pooled account contracts, SSO and SCIM.
