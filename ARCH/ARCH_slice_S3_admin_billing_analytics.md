# ARCH Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-20
**Mode**: Architecture slice.
**Status**: Active architecture pivot. Existing admin, ledger, seat, subscription and AiRun facts are reusable, but Team charging must move to a workspace-owned Team wallet. Local operator/admin hot paths have now been tightened around dedicated read models and pooled-runtime observability; public pricing and legal/policy pages now exist without Auth while live checkout stays disabled; real staging session/admin smoke is green. The 2026-05-20 post-stage browser-write fix keeps admin/workspace writes behind server-derived auth and same-origin proxying instead of weakening backend CSRF/origin checks; live AI/payment depth and remaining browser verification are still the next gates.

## Scope

Server authority and data contracts for:

- Team purchase, workspace creation, member roles, seats and Team wallet.
- Group/Collaborate subscription, Group workspaces and personal-wallet charging.
- Invite links and invite acceptance.
- Billing usage, top-ups, seat additions, subscription lifecycle and ledger facts.
- Admin/developer observability for users, teams, boards, AiRuns, provider routes, costs and credits.
- Admin operator read models for fast user inventory, one-call user detail bundles, Team/Group plan tabs and modal-backed operations.
- Public no-auth pricing, Privacy, Terms and AI policy pages that can describe the commercial model before registration without holding payment secrets or creating payments.

## Authority Rules

- Product plans are not Auth roles.
- Workspace roles are not global admin roles.
- Board roles are not billing visibility.
- Frontend may request an active workspace, model and parameter tier, but the server resolves membership, permission, payer, route and price.
- Provider secrets, raw provider routes and provider pricing stay server-side.
- Board documents, node props and Board History store compact refs and summaries only.
- Public `/pricing` may display plan facts, but live checkout, tax, invoice and refund authority must stay server-owned behind payment-provider readiness, signed webhooks, ledger writes and legal/compliance review.
- Public legal/policy pages are static product documents for now. They must not read `.env`, payment credentials, database URLs or private operator notes.
- Next-to-FastAPI admin/workspace proxying is allowed only as a narrow same-origin browser bridge. The proxy must derive auth server-side or prefer an existing browser Bearer token without forwarding arbitrary browser cookies or spoofable `x-tangent-*` role/plan headers, must keep a route allowlist, and must preserve trusted Origin semantics so FastAPI write-route CSRF/origin protections remain active.

## 2026-05-16 Confirmed Policy Invariants

These commercial invariants are now fixed and should be treated as backend/frontend contract authority:

- `group_workspace` is a collaboration shell, not a shared wallet owner.
- Team workspaces always resolve AI charging to a workspace-owned `team_wallet`.
- Solo and Group workspaces always resolve AI charging to the acting user's personal wallet.
- Invite acceptance checks invite validity plus target workspace capacity/state only. It does not reject a user for being on the free tier.
- `free_canvas` may create exactly one Group and may still join other Groups/Teams.
- Group member limit is currently `15` across personal plans.
- A free-owned Group inherits the free-canvas workspace envelope for collaboration: `1` Board and `3` Pages per Board.
- Collaborate Start / Plus expand Group count and personal included credits only; they do not mint any Group-owned credit pool.
- Personal-plan annual pricing must be interpreted as `annual_price_usd × 12` collected upfront for a 365-day term.
- Subscription included credits are cycle-scoped runtime grants: the cycle starts at payment completion, refreshes every 30 days and does not carry unused included credits forward.
- Team included-credit grants remain seat-based: `2500 / seat` for Team Start and `5500 / seat` for Team Growth.
- Team pricing is seat-based too: monthly catalog values are per-seat monthly prices, and annual catalog values are per-seat annual-term monthly rates that must be collected as `price × 12 × seat_count` upfront for a 365-day term.
- Upgrade flows must preserve existing top-up balances and apply included-credit grants additively rather than resetting balance state.

## Admin Operator Console Redesign

The current admin backend has useful primitives, but the operator UI should not compose slow per-panel fetches. A first server-owned admin operator read model now sits on top of existing users, workspaces, subscriptions, wallets, ledger, payments and audit logs.

Target routes:

```text
GET  /api/v1/admin/operator/users
GET  /api/v1/admin/operator/users/{user_id}
POST /api/v1/admin/operator/users/{user_id}/status
POST /api/v1/admin/operator/users/{user_id}/delete
POST /api/v1/admin/operator/subscriptions/{subscription_id}/freeze
POST /api/v1/admin/operator/subscriptions/{subscription_id}/unfreeze
POST /api/v1/admin/operator/workspaces/{workspace_id}/members
PATCH /api/v1/admin/operator/workspaces/{workspace_id}/members/{user_id}
DELETE /api/v1/admin/operator/workspaces/{workspace_id}/members/{user_id}
GET  /api/v1/admin/operator/workspaces/{workspace_id}/invitations
POST /api/v1/admin/operator/workspaces/{workspace_id}/invitations
DELETE /api/v1/admin/operator/workspaces/{workspace_id}/invitations/{invitation_id}
POST /api/v1/admin/operator/workspaces/{workspace_id}/boards/{board_id}/copy
DELETE /api/v1/admin/operator/workspaces/{workspace_id}/boards/{board_id}
GET  /api/v1/admin/finance/plan-catalog
PUT  /api/v1/admin/finance/plan-catalog/{plan_key}
GET  /api/v1/billing/plans
```

Implemented first pass:

- `GET /api/v1/admin/operator/users`
- `GET /api/v1/admin/operator/users/{user_id}`
- `POST /api/v1/admin/operator/users/{user_id}/status`
- `POST /api/v1/admin/operator/users/{user_id}/delete`
- `POST /api/v1/admin/operator/subscriptions/{subscription_id}/freeze`
- `POST /api/v1/admin/operator/subscriptions/{subscription_id}/unfreeze`
- `POST /api/v1/admin/operator/workspaces/{workspace_id}/members`
- `PATCH /api/v1/admin/operator/workspaces/{workspace_id}/members/{user_id}`
- `DELETE /api/v1/admin/operator/workspaces/{workspace_id}/members/{user_id}`
- `GET /api/v1/admin/operator/workspaces/{workspace_id}/invitations`
- `POST /api/v1/admin/operator/workspaces/{workspace_id}/invitations`
- `DELETE /api/v1/admin/operator/workspaces/{workspace_id}/invitations/{invitation_id}`
- `POST /api/v1/admin/operator/workspaces/{workspace_id}/boards/{board_id}/copy`
- `DELETE /api/v1/admin/operator/workspaces/{workspace_id}/boards/{board_id}`
- `/admin?tab=users` renders the operator inventory from the read model.
- `/admin/users/[userId]` renders Billing, Team Plan, Joined Team, Group Plan and Joined Group from the detail bundle.
- Billing history now materializes as a unified timeline of payment, credit-ledger, subscription and admin-audit rows instead of a ledger-only list.
- Existing audited `/api/v1/admin/finance/manual/*` writes are now reachable from centered user-detail modals for personal credits, Team credits, Team plan/create, Group create, Collaborate plan, subscription cancel and workspace delete.
- `POST /api/v1/admin/finance/manual/group-plan-operation` and `POST /api/v1/admin/finance/manual/team-plan-operation` now provide the mock-aligned modal contract for `assign`, `renew`, `upgrade`, `delete`, `freeze` and `unfreeze`, returning `action`, `effectiveAt`, `periodStart`, `periodEnd`, `planKey`, `previousPlanKey`, `seatCapacity`, `subscriptionStatus` and `grantedCredits`.
- `/admin/users/[userId]` Team Plan and Group Plan tabs now consume those plan-operation contracts directly for renew/upgrade/delete/freeze/unfreeze instead of routing owned-plan actions through the older set-plan plus generic subscription-write split.
- Native operator writes now cover user block/unblock/delete, subscription freeze/unfreeze and joined Team/Group member role/remove actions so those actions do not have to flow through the manual-finance bridge.
- User delete is no longer just a status flip: operator delete now runs the shared hard-delete path, removes local user-owned solo data, preserves shared Board content by reassigning authored Board/Asset/Snapshot/AiRun rows to the workspace owner, deletes direct log rows, and blocks deletion when the target still owns a non-solo Team/Group workspace or is the last active admin owner.
- The shared hard-delete service now returns a structured `409 account_delete_blocked` detail model for both `/api/v1/auth/account` and admin delete. First-pass blockers now cover owned Team/Group workspaces, joined Team/Group memberships, active Team seat assignments, active subscriptions and still-pending invites owned by the deleting actor. The next cut is no longer the blocker model itself; it is richer operator/self-serve UI rendering plus broader real-account smoke around those blockers.
- Operator-owned Team and Group rows now render as dense inventory tables: Team rows expose Team wallet, seats, members, boards and Team plan actions in one pass, while owned Team/Group member rows can now open native role-change or remove-member modals inline from the table itself.
- Owned Team/Group rows now also expose native operator `Invite` and `Add member` actions against arbitrary workspaces, and board rows can now trigger audited admin `Copy` and `Delete` writes instead of stopping at read-only labels.
- Joined Team and Joined Group now also expose native operator `Join Team` / `Join Group` entry points. The modal uses `/api/v1/admin/directory/workspaces?kind=...&search=...` for server-side workspace lookup, then executes the existing `POST /api/v1/admin/operator/workspaces/{workspace_id}/members` contract with the target user.
- `/api/v1/admin/directory/workspaces` now also supports paginated `limit` + `offset` response facts with `totalCount`, so top-level Team and Group dashboards can scale past the first local page instead of loading a fixed list and filtering it on the client.
- The AI API Routes admin surface now shares the same table-first operator language as the rest of `/admin`: route inventory is selected from a dense table filtered by kind/search/provider/model/enabled state, detail editing stays in a dedicated right-hand form panel, route consumption remains split into image/text/video tables, and the lower runtime panel now groups API calls by `runId` with inline failover-attempt expansion instead of showing only raw attempt rows.
- The AI API Routes local runtime pass now also shares one selected-run state between the right-side recent-runs table and the lower grouped ledger, and exposes an operator summary strip for direct wins, fallback-away wins, terminal failures, attempts-per-run and last route hit.
- `/api/v1/admin/ai/route-metrics` now also materializes long-window route-health facts on the server side, including direct wins, fallback wins, terminal failures, route-hit runs, average attempts per run, direct win rate and route-attempt success rate. The dense route tables consume those backend facts directly instead of deriving everything from the current in-memory route window.
- Operator detail bundles now hydrate pending workspace invitations directly into owned and joined Team/Group rows, so invite state lives beside the member stack instead of requiring an extra workspace fetch.
- After the first detail load, member role/remove, add-member, invite create/revoke and board copy/delete actions can patch the local detail bundle immediately; full refetch is still reserved for larger billing/plan/workspace mutations.
- Search-backed join-workspace actions can now also patch the local detail bundle by projecting the selected workspace lookup row into the joined Team/Group table, so the operator does not wait on a forced detail reload just to see the new membership row appear.
- A local/demo-rich QA seed now exists at `services/api/scripts/seed_admin_operator_demo.py`, so the operator console can be exercised against owned Teams, joined Teams, owned Groups, joined Groups, pending invites, boards, ledger rows and manual-payment rows without hand-building fixtures in the current staging database.
- Operator inventory/user detail now expose derived registration state plus `tangent_users.last_ip_address`, so the later dense-table redesign can render real access facts instead of placeholders.
- Subscription freeze/unfreeze now persists `paused_at`, `paused_by` and `pause_reason`, and unfreeze extends `current_period_end` by the paused duration instead of silently resuming on the original expiry date.
- Manual plan grants now follow operator semantics instead of the older blunt overwrite path: `assign` and `renew` grant the full included-credit pack for the target plan, while `upgrade` grants only the delta from the current included-credit pack to the target included-credit pack.
- Finance now also exposes a DB-backed plan catalog editor. The catalog merges code defaults with `tangent_plan_catalog` overrides, and the admin write surface is `GET/PUT /api/v1/admin/finance/plan-catalog/{plan_key}` with a public read-only `GET /api/v1/billing/plans`.
- The plan catalog editor is now the intended market-adjustment control plane too: admins can change monthly price, annual price, included credits and registration credits there without shipping a frontend rebuild, and downstream runtime readers must honor those updated values.
- Runtime billing and entitlement readers now consume the active plan catalog for free-registration credits, Team/Collaborate included credits, board/page limits, group caps, seat caps and plan pricing instead of relying only on static constants.
- The next `Subscription`/`Usage` UI pass will need richer read models too. `Subscription` may continue to sit on the existing `/billing` route in the near term, but the product-surface contract is now two tabs: `Subscription` for plan catalog/purchase and `Usage` for active-plan/consumption state. Personal-plan and Team-plan payloads must include current period start/end, valid-until, next-refresh, included credits, remaining credits, top-up balance, board limits, page limits, group limits, seat limits and active workspace counts so the frontend can render long-form vertical comparison/usage bands without stitching facts from many small calls.
- That read model should be explicit enough to drive full-width long containers directly:
  - Personal plan bands need plan status, monthly/annual display price, annual upfront note, current period, valid-until, next-refresh, included credits, top-up balance, group create cap, group member cap, solo board/page limits, free-owned Group board/page limits and CTA state.
  - Team plan bands need workspace identity, plan status, monthly/annual seat price, annual upfront note, current period, valid-until, next-refresh, included credits per seat, remaining Team credits, current seat count, seat cap, Team board count, Team member count, wallet scope and CTA state.
  - `Usage` needs the same validity facts plus active plan/workspace facts and ledger slice facts, because the UI target is not a modal drill-in flow; it is a vertically stacked status surface.

### AI Routes Progress Swimlane

This is a local implementation-readiness snapshot for the current AI API Routes/operator pass as of 2026-05-10. The percentages are coarse architecture/UI readiness, not time estimates.

```text
AI API Routes operator lane       95%  [###################-]

Route inventory/filter shell     100%  [####################]
  Stable: kind tabs, search, enabled/provider/model filters and dense row selection.

Route control-plane detail       100%  [####################]
  Stable: edit/save form, version history, publish, rollback and optional audit note.

Route-aware runtime reads         95%  [###################-]
  Stable: `/admin/ai/runs` + `/admin/ai/api-calls` accept `routeId`, with route-key/provider fallback for older rows, and `/admin/ai/route-metrics` now exposes long-window route health beyond raw call counts.
  Remaining gate: higher-volume query/index smoke and staging redeploy verification.

Recent runs drilldown             96%  [###################-]
  Stable: selected-route recent runs, per-run attempt drilldown, failover-route visibility, selected-route highlighting and shared selection state with the lower ledger.
  Remaining gate: remote smoke against staging data after redeploy.

Grouped API-call ledger           94%  [###################-]
  Stable: full-width `runId` ledger, final status, attempt count, selected-route credits/cost, inline inspect, attempt expansion and cross-panel run selection sync.
  Remaining gate: operator sorting/pinning refinements if the dataset grows.

Route-health / live-smoke depth   81%  [################----]
  Stable: operator runtime summary covers the live route window, while `/admin/ai/route-metrics` now aggregates long-window direct wins, fallback wins, terminal failures, route-hit runs, attempts-per-run, direct win rate and route-attempt success rate.
  Remaining gate: remote real-login smoke after staging redeploy, plus higher-volume query/index verification on production-like data.
```

Read-model requirements:

- User inventory returns active and expired Team plans, active and expired Collaborate/Group plans, personal wallet summary, Team wallet summaries, total spent and status in one paginated response.
- Paused subscriptions are treated as current plan rows in operator inventory/detail, not historical rows.
- User detail returns Billing, Team Plan, Joined Team, Group Plan and Joined Group bundles in one response.
- Billing history merges payments, credit ledger, subscriptions and admin audit facts into operator rows.
- Joined Team/Group views are driven by membership rows and server-side permission facts, not frontend guesses.
- Every write remains server-gated through `admin_roles` and writes audit metadata with a required reason.

## 2026-05-20 Browser Write Regression Boundary

The security hardening pass intentionally made backend write routes stricter. The follow-up browser regression fix keeps that security posture while restoring product writes:

- Admin proxy uses a Bearer-first request path and avoids forwarding broad browser cookies or spoofable workspace role/plan headers.
- Workspace/dashboard/invite mutations use a same-origin workspace proxy with an explicit route allowlist instead of direct cross-origin browser writes where CSRF/origin policy can reject legitimate signed-in UI actions.
- Invite generate/revoke, admin content edits and workspace member mutations must be smoke-tested on staging after redeploy with a real signed-in operator/member session.
- Any future proxy expansion must update the Admin route matrix tests and the Next security guard before being treated as accepted.

Performance and UI contract:

- `/admin?tab=users` should fetch one inventory page, cache it on the client and keep search, pagination and scroll state when returning from a detail page.
- `/admin` now server-bootstraps admin access plus the active tab seed bundle, then background-warms the remaining top-level tabs after idle so Users, Teams, Groups, AI, Finance and Access switch locally instead of reloading the route shell each time.
- `/admin/users/{user_id}` should render from the server-seeded operator detail bundle on first open and reopen from the cached operator detail bundle when available, while hover/focus on Detail pre-warms that bundle. Local tab switching must not call access checks or workspace detail endpoints again.
- Workspace invite/member/board row actions should update the visible detail table from the existing bundle whenever the server response already contains enough mutation facts; they should not force a second detail fetch just to reflect the row change.
- Frontend tables render real read-model arrays directly. They should not compose inventory rows by fetching every Team, Group, wallet, ledger or member record separately.
- Empty states can be terse table rows only. Do not add explanatory helper copy under tabs, panels or cards.
- Actions open centered modals with reason fields. First-pass modals reuse the manual finance bridge for credit/plan/workspace writes, while native operator writes now cover user status/delete, subscription freeze/unfreeze and joined Team/Group member role/remove operations.

## Account Deletion Boundary

Current hard-delete behavior is live for both `/account` self-delete and admin delete, but the paid-workspace boundary needs one more hardening pass before it is considered complete.

Current blockers:

- still owns a non-solo Team/Group workspace
- is the last active admin owner

Next blocker set to add before collaboration/billing scale-up:

- joined paid Team/Group membership still active
- active Team seat assignment still attached
- owned active Team or Collaborate subscription still present
- pending workspace invitations still owned by the deleting actor when that invite state would become orphaned

Target response shape for self-delete blockers:

```text
DELETE /api/v1/auth/account
  -> 409 account_delete_blocked
       blockers[]
         owned_team_workspace
         owned_group_workspace
         joined_team_workspace
         joined_group_workspace
         active_team_seat
         active_subscription
         orphaned_invites
```

Rule:

- free/solo-only users may self-delete immediately
- paid/team/group-attached users must first transfer, leave, cancel or clear the blocking records
- admin delete should reuse the same blocker model unless a later explicit transfer workflow is introduced

Operator detail bundle shape:

```text
account_profile
billing_history[]
owned_team_plans[]
joined_team_workspaces[]
collaborate_plan
owned_group_workspaces[]
joined_group_workspaces[]
available_actions
```

Small schema delta status:

- `tangent_users.last_ip_address` is now the first durable operator access fact.
- `tangent_subscriptions.paused_at/paused_by/pause_reason` now back operator freeze semantics.
- inventory/detail indexes over users, workspace members, workspaces, subscriptions, ledger and audit logs still need a deeper pass once real volume arrives.

## Workspace And Wallet Model

Workspace kinds:

```text
solo_workspace
group_workspace
team_workspace
enterprise_workspace
```

Plan families:

```text
free_canvas
collaborate_start
collaborate_plus
team_start
team_growth
enterprise
```

Credit accounts:

```text
credit_accounts.owner_type = user | workspace
credit_accounts.owner_id   = tangent_users.id | tangent_workspaces.id
credit_accounts.account_kind target = personal_wallet | team_wallet | enterprise_pool
```

Implementation note: if the current database lacks `account_kind`, add it or store the equivalent in a constrained metadata column during the next S3 migration. The important invariant is that Team credits are workspace-owned, while Collaborate credits are user-owned.

Subscriptions:

```text
subscriptions.account_id -> credit_accounts.id
subscriptions.plan_key
subscriptions.plan_family = free | collaborate | team | enterprise
subscriptions.status
subscriptions.seat_capacity
subscriptions.current_period_start/end
provider_subscription_id / provider_customer_id
```

Constraints:

- One user may have only one active `collaborate_*` subscription.
- One user may own or belong to many `team_workspace` records.
- Each Team workspace has its own wallet, subscription, seat capacity, members, Boards, usage rollups and ledger.
- Team seat assignment controls membership capacity and usage attribution; it does not create the payer account.

## Plan Catalog Authority

Canonical admin-editable plan fields now include:

```text
name
billing_period
monthly_price_usd
annual_price_usd
included_credits
registration_credits
board_limit
page_limit
group_workspace_limit
group_member_limit
seat_min
seat_max
seat_range
```

Authority rules:

- The backend must treat the active plan catalog as the source of truth for commercial limits and included-credit math.
- Monthly price, annual price, included credits and registration credits are market-tunable admin inputs, not frontend constants.
- For personal plans, annual checkout amount must multiply `annual_price_usd` by `12` and create a 365-day term.
- For Team plans, `monthly_price_usd` and `annual_price_usd` are both per-seat inputs. Annual checkout amount must multiply the annual per-seat rate by `12` and by `seat_count`, and create a 365-day term.
- New-user bootstrap reads `free_canvas.registration_credits`.
- Board creation/save guards read the active board/page limits.
- Team and Collaborate purchase/manual-plan flows read the active included-credit and cap values.
- Subscription-period ledger/grant logic must distinguish cycle-scoped included credits from persistent top-up credits.
- Invite capacity checks and workspace-create guards must read the active group/seat caps from the same catalog authority.

Billing UI contract additions:

- Personal plan cards need:
  - currentPeriodStart
  - currentPeriodEnd / validUntil
  - includedCredits
  - remainingCredits
  - topUpBalance
  - groupWorkspaceLimit
  - groupMemberLimit
  - boardLimit
  - pageLimit
- Team plan cards need:
  - currentPeriodStart
  - currentPeriodEnd / validUntil
  - includedCreditsPerSeat
  - remainingCredits
  - topUpBalance
  - seatCapacity
  - seatsUsed
  - boardCount
  - memberCount
  - role / permission summary

## Payer Resolution Matrix

| Context | Required permission | Charged account | Visibility |
| --- | --- | --- | --- |
| Solo/free Board | Board edit/run permission and personal balance | Actor personal wallet | Actor only |
| Group/Collaborate Board | Board edit/run permission and actor personal balance | Actor personal wallet | Actor only; Group admin sees structure, not billing |
| Team Board | Board edit/run permission, active Team membership, Team wallet balance | Team wallet for the active Team workspace | Team owner/admin sees member and Team usage |
| Enterprise Board | Contract-specific permission | Enterprise workspace pool or contract-defined account | Contract-defined |

Recommended charge scopes:

```text
actor_personal
team_wallet
enterprise_workspace_pool
```

If the current code can only store `workspace_pool`, use `charged_scope=workspace_pool` plus `entitlement_source=team_wallet` until the enum is widened. Do not let the frontend infer this.

## Purchase And Invite Flows

Team purchase:

```text
POST /api/v1/billing/teams/checkout
  -> create pending team_subscription payment owned by the buyer's personal context

payment completed
  -> create team_workspace
  -> create owner/admin workspace_members row
  -> create workspace-owned credit_account(account_kind=team_wallet)
  -> create subscription(plan_key=team_start|team_growth, seat_capacity=n)
  -> write payment/invoice/webhook facts
  -> write subscription_grant credit_ledger entry to Team wallet
  -> audit admin/system facts
```

Implementation checkpoint: the backend checkout/complete contract exists with manual-test payment completion. Checkout amount semantics should now be read as `monthly_price_usd` for personal monthly billing, `annual_price_usd × 12` for personal annual billing, `monthly_price_usd × seat_count` for Team monthly billing, and `annual_price_usd × 12 × seat_count` for Team annual billing, with annual terms collected upfront for 365 days. Checkout responses now include a `checkout` object; non-manual providers require hosted checkout configuration before a payment is created, can expose a hosted checkout URL with amount/currency/kind/client-reference handoff metadata and cannot be manually completed. The payment layer is provider-neutral: `manual_test` and generic hosted checkout can keep staging moving while Stripe is unavailable. The optional Stripe checkout adapter first cut requires `TANGENT_STRIPE_SECRET_KEY` only when `stripe` is selected, creates Checkout Sessions through Stripe's server API, writes internal payment/session references into provider metadata and labels `checkout.adapter=stripe_checkout`; it does not read local secret files. A first signed webhook inbox also exists: `POST /api/v1/billing/webhooks/{provider}` validates `TANGENT_PAYMENT_WEBHOOK_SECRET`, stores provider events in `tangent_webhook_events`, calls the shared payment completion path for supported checkout success events by internal payment id, client reference or provider metadata checkout session id and avoids duplicate grants for repeated provider event ids. The frontend now has hosted checkout return routes at `/billing/success` and `/billing/cancel`, and `/usage` buttons call the real Team top-up, Team seat checkout, personal top-up and Group create routes. Admin finance reconciliation now has server-gated read endpoints and frontend panels for payments, credit ledger rows, subscriptions, wallets and Team member usage. Admin directory APIs now expose user, Team and Group aggregates plus workspace member/board detail, and `/admin` is split into Overview, Users, Teams, Groups, AI API Routes, Finance and Access tabs. Because Stripe is not available yet, the developer panel also has audited `admin_manual` operations for user personal-wallet top-up, user/Team credit deduction, Collaborate/Group plan assignment, Team plan assignment, Team/Group workspace creation, subscription cancellation and workspace deletion. Every manual write requires an operation reason, and plan windows are driven by `effectMode` plus `durationCount * durationUnitDays` rather than a date picker. Local disposable-Postgres smoke now covers admin finance reads plus manual admin, manual-test and hosted payment flows; local live API smoke covers the new admin directory and AI route metrics endpoints. Remote staging still needs a redeploy before real-login smoke can pass. Provider-specific signatures, invoices, refunds and production payment reconciliation still need implementation.

Team seat add:

```text
owner/admin checkout
  -> update subscription seat_capacity
  -> grant incremental included credits to Team wallet
  -> allow assigning seats to active/invited members up to capacity
```

Team wallet top-up:

```text
owner/admin checkout in active team_workspace
  -> create workspace_topup payment owned by the Team wallet
  -> payment completed writes topup_purchase to the workspace-owned credit_account
```

Collaborate purchase:

```text
checkout completed
  -> ensure user personal_wallet
  -> enforce no other active collaborate subscription
  -> create/update user subscription(collaborate_start|collaborate_plus)
  -> write subscription_grant to personal wallet
  -> allow Group creation/invite flows according to plan limits
```

Implementation checkpoint: `/api/v1/billing/collaborate/checkout` and payment completion now create/update the user's single active Collaborate subscription and grant included credits to the personal wallet. Included-credit upgrades must be additive and preserve any pre-existing personal top-up balance.

Group create:

```text
POST /api/v1/workspaces/groups
  -> resolve actor personal plan from the active plan catalog (default free_canvas)
  -> enforce the plan's group_workspace_limit against owned active group_workspaces
  -> create group_workspace
  -> create owner workspace_members row
  -> apply the plan-derived Group board/page entitlement envelope
  -> future invites share Boards while AI spend stays actor-personal
```

Implementation checkpoint: Group creation no longer depends on the invitee or owner being on a paid Collaborate plan. Free Canvas may create one Group, and the resulting free-owned Group inherits the free-canvas Board/Page caps while still allowing the owner to join other Groups.

Invite acceptance:

```text
create invite link/email invite
  -> store workspace_id, target role, inviter, expiry, optional target email
  -> signed-in recipient accepts
  -> server verifies token, expiry, workspace policy and seat capacity if Team
  -> create/update workspace_members
  -> optional board_members grant
  -> audit membership change
```

Implementation checkpoint: backend workspace invite create/list/accept/revoke/expiry contracts exist. Invite tokens are stored only as hashes. The current first cut verifies token state and optional target email/user, then creates/updates workspace membership. Team invite accept also requires an active Team subscription with remaining seat capacity and creates the member's seat assignment without granting duplicate credits. Team and Group dashboard surfaces now load the server dashboard when available and wire invite/create/revoke, member remove, member role update and Team seat assignment actions to the real routes. Email delivery, board-specific assignment UI and audit events remain.

Member removal:

```text
owner/admin removes member
  -> prevent owner removal/self-removal through this endpoint
  -> delete workspace_members row
  -> if team_workspace, revoke active workspace_seat_assignments for that member
```

Admin/operator member-management chain:

```text
admin detail view
  -> invite create / invite revoke
  -> add member directly
  -> change member role
  -> remove member
  -> searchable Join Team / Join Group
  -> Team owner transfer
  -> Group owner transfer stays blocked
```

Contract rule: these flows all mutate the same workspace membership, invitation and seat tables. The admin UI must not maintain a separate collaboration-membership model.

## Permission Boundaries

Workspace roles:

```text
owner/admin/editor/viewer
```

Board roles:

```text
owner/admin/editor/viewer/temporary_viewer
```

User-facing Board labels:

```text
Owner      -> owner
Can manage -> admin
Can edit   -> editor
Can view   -> viewer | temporary_viewer
```

Rules:

- Board `Can edit` allows content editing but not AI execution by itself.
- Board `Can manage` allows invite/share/rename/visibility/member management but not owner-only copy/delete.
- Team billing visibility requires Team workspace owner/admin, not Board admin.
- Group admin/editor/viewer roles do not expose another member's wallet or usage.
- Public share links remain view-only until a separate editor-via-share product decision exists.

## AiRun Charge Contract

```text
Node Run click
  -> ApiRequestContext resolves actor user + active workspace
  -> WorkspaceAccessService resolves workspace kind and membership
  -> BoardPermissionService resolves Can view/edit/manage/Owner
  -> BillingEntitlementService resolves subscription, wallet and payer policy
  -> ModelPricingService resolves model tier, pricing rule and estimate
  -> AiChargePreflight checks permission, balance, rate limit and model allowance
  -> create ai_run with actor/workspace/board/node/model/tier/pricing/route/charged_account
  -> ProviderRouteService chooses route server-side
  -> provider adapter executes
  -> Asset service stores outputs
  -> CreditLedgerService settles usage/refund
  -> ApiCostLedgerService stores provider cost facts
```

Required persisted run facts:

```text
actor_user_id
workspace_id
workspace_kind
board_id
node_id
product_model_key
selected_tier_key
pricing_rule_id
route_id
charged_account_id
charged_scope
entitlement_source
credits_estimated
credits_charged
credits_refunded
provider_cost
provider_currency
```

## Required Database Delta

The next migration should confirm or add:

- `credit_accounts.account_kind` or equivalent constrained metadata.
- `subscriptions.plan_family`, `seat_capacity`, current-period columns and provider ids.
- Partial unique index for one active Collaborate subscription per user.
- Team workspace purchase linkage: payment/subscription -> workspace -> wallet.
- Workspace invite tokens with expiry/revoke/acceptance state.
- Seat capacity and member assignment facts that do not imply personal credit ownership.
- `ai_runs.node_id` if node-level attribution is not already durable.

## Admin Console IA

Current developer console tabs:

```text
Overview
  -> global counts, Team/Group inventory and operator map
Users
  -> registered user list, personal wallet, Collaborate/Group plan, owned Teams/Groups and focused manual user actions
Teams
  -> all Team workspaces, owner/member/board counts, Team wallet, Team plan and Team member/board detail
Groups
  -> all Group workspaces, owner/member/board counts, owner Collaborate plan and Group member/board detail
AI API Routes
  -> image/text route metrics, credits, provider cost, failures, latency plus model/route/pricing control plane
Finance
  -> payment, wallet, subscription, credit ledger and member-usage reconciliation
Access
  -> global admin roles and audit log
```

Server-backed endpoints added for this IA:

```text
GET /api/v1/admin/directory/users
GET /api/v1/admin/directory/workspaces?kind=team_workspace|group_workspace
GET /api/v1/admin/directory/workspaces/{workspace_id}
GET /api/v1/admin/ai/route-metrics
```
- Charge-scope widening or `entitlement_source=team_wallet` compatibility mapping.

## Planned API Capability Map

Auth/workspace:

```text
GET  /api/v1/auth/session
GET  /api/v1/workspaces
POST /api/v1/workspaces/groups
POST /api/v1/billing/teams/checkout
POST /api/v1/billing/collaborate/checkout
```

Invites/members:

```text
POST /api/v1/workspaces/{workspaceId}/invites
GET  /api/v1/workspace-invites/{token}
POST /api/v1/workspace-invites/{token}/accept
GET  /api/v1/workspaces/{workspaceId}/members
PATCH /api/v1/workspaces/{workspaceId}/members/{userId}
DELETE /api/v1/workspaces/{workspaceId}/members/{userId}
```

Billing/wallet:

```text
GET  /api/v1/billing/me
GET  /api/v1/billing/team/{workspaceId}
POST /api/v1/billing/topups/personal/checkout
POST /api/v1/billing/topups/team/{workspaceId}/checkout
POST /api/v1/billing/team/{workspaceId}/seats/checkout
GET  /api/v1/credits/ledger
GET  /api/v1/workspaces/{workspaceId}/usage
```

AI/admin:

```text
POST /api/v1/ai/runs/quote
POST /api/v1/ai/runs
GET  /api/v1/admin/ai/runs
GET  /api/v1/admin/ai/api-calls
GET  /api/v1/admin/finance/summary
GET  /api/v1/admin/finance/payments
GET  /api/v1/admin/finance/wallets
GET  /api/v1/admin/finance/subscriptions
GET  /api/v1/admin/finance/credit-ledger
GET  /api/v1/admin/finance/member-usage
```

Exact route names may change, but the capabilities and server authority must remain.

## Current State

Reusable:

- Server-gated Admin and audit log scaffolds.
- Billing/team/usage first-pass UI, including real `/usage` checkout/create button wiring and billing success/cancel return routes.
- `workspace.kind`, membership, seat assignment, usage/dashboard facts.
- Credit ledger helpers and preflight/read routes.
- Payment checkout/complete scaffolds.
- S2 model/route/pricing control plane, AiRun lifecycle and provider-cost facts.
- Board permission resolver and share/member first pass.

Implemented in the 2026-05-08 first cut:

- Migration `20260508_0012` adds wallet account kind, subscription ownership/family/seat capacity, one-active Collaborate and Team workspace subscription indexes, invite token facts and `team_wallet` charge scope.
- Team payer resolver now returns the workspace-owned Team wallet for Team entitlement/quote.
- Team seat assignment now grants included credits to the Team wallet instead of a member personal wallet.
- Team seat checkout completion now writes Team subscription ownership/seat-capacity facts and a Team wallet subscription grant.
- Team top-up targets the Team wallet.
- Collaborate checkout enforces the single active personal Collaborate subscription contract and grants credits to the personal wallet.
- Hosted checkout response contract exists for non-manual providers; missing hosted checkout configuration fails before payment creation and manual completion is blocked for hosted-provider payments.
- Provider-neutral checkout first cut supports manual-test and generic hosted checkout; the optional Stripe adapter requires server-side `TANGENT_STRIPE_SECRET_KEY` only when selected, creates Stripe Checkout Sessions and labels checkout responses with `adapter=stripe_checkout`.
- Signed payment webhook inbox first cut records provider events and completes top-up/subscription payments through the shared grant path by internal payment id, client reference or provider metadata checkout session id with duplicate-event idempotency.
- Admin finance reconciliation first pass exposes server-gated summary, payment, wallet, subscription, credit ledger and Team member usage read APIs, with matching frontend panels and audit-log entries.
- Workspace invite create/list/accept/revoke and member removal contracts exist for Team and Group.
- Mock AI run settlement now has contract coverage for Group actor-personal charging, Team wallet charging and immutable charge context during polling/cancel.
- Disposable Postgres smoke passed for migration-to-head, Team checkout/invite/quote/run-settlement/remove and Collaborate/Group create/invite/quote/run-settlement.
- Local admin/payment smoke passed for `/admin` finance panel reads, manual-test Team wallet top-up, manual-test Team seat checkout plus assignment, and hosted checkout redirect/manual-complete rejection.

Remaining rework:

- Hosted staging smoke still needs to run against managed Postgres and deployed API/Web; current remote Web/API returned 404 for `/admin` and `/api/v1/admin/finance/*` before redeploy.
- Hosted live-provider run-settlement smoke still needs to exercise real provider output persistence through the same payer contract.
- Provider-specific webhook signatures, invoice/refund handling and deployed staging smoke must replace manual-test completion as the authority for grants and subscription state.
- Email invites, board-specific assignment UI and richer audit events remain.
- GeekAI-first canvas fast path must be reconciled into S2 server provider-route/billing control plane before production reliance.
