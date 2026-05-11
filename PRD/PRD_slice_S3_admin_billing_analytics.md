# PRD Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-10
**Mode**: Product slice.
**Status**: Active commercial-architecture slice. Existing admin, ledger, seat and AI-control-plane scaffolds remain useful, but the Team charging rule has pivoted from member-personal credits to a Team wallet.

## Goal

Make Team, Group/Collaborate, wallets, seats, invites, usage, billing and admin monitoring coherent before real provider charging and payment automation become production authority.

## 2026-05-08 Product Decision

Team and Group are different commercial products:

| Area | Team Start / Team Growth | Group / Collaborate Start / Collaborate Plus |
| --- | --- | --- |
| Purchase creates | A new isolated `team_workspace` | A personal Collaborate subscription; user may create/join collaboration groups under that personal plan |
| Multiplicity | One user may own or belong to multiple Teams | One user may have only one active Collaborate subscription: Start or Plus |
| Credit owner | Team wallet, modeled as a workspace-owned credit account | Personal wallet, modeled as a user-owned credit account |
| Included credits | Seat purchase grants credits into the Team wallet total account | Subscription grants credits into the paying user's personal wallet |
| Top-up | Team top-up adds credits to the Team wallet | Personal top-up adds credits to the user wallet |
| AI charge in workspace | Team Board runs charge the Team wallet after permission/preflight | Group Board runs charge the acting user's personal wallet |
| Member billing visibility | Team owner/admin can see Team wallet, seat capacity, member usage and Board usage | Group admin manages members/Boards but cannot see another member's credit balance, billing usage or invoices |
| Member roles | Workspace admin/editor/viewer plus Board roles | Workspace admin/editor/viewer plus Board roles |

Enterprise may later use a contract-defined workspace pool, but it is not the alpha default.

## Product Requirements

| Area | Requirement | Current status |
| --- | --- | --- |
| Admin access | `/admin` is server-gated through `admin_roles`; all admin writes are audited. | First-pass stable |
| Admin operator console | Developer admin views are inventory-first and detail-bundle-first: user inventory, one-call user detail, Billing / Team Plan / Joined Team / Group Plan / Joined Group tabs, modal actions and no explanatory helper copy. Owned Team/Group rows must support developer-side invite/add-member actions, board rows must support admin copy/delete, pending invites should be visible inline in the same row stack as members, Joined Team / Joined Group must let developer admin place a user into an existing workspace through searchable modal lookup, and top-level Team/Group dashboards must support real search/pagination for larger inventories. | First-pass operator read model, inventory table, detail tabs, unified billing history, manual-finance modals, user status writes, subscription freeze/unfreeze, arbitrary workspace invite/add-member actions, inline pending invite rows, row-level local detail patching for invite/member/board actions, board copy/delete actions, searchable Join Team/Join Group modals, server-seeded first-open detail, background-warmed top-level tabs, paginated Team/Group dashboards and an opt-in demo seed for dense local QA are implemented locally; higher-volume/staging operator smoke remains |
| Plan catalog | The Finance tab is the operations-owned subscription catalog. Developer admins can edit per-plan board limits, page limits, included credits, registration credits, group caps, seat caps and monthly/annual pricing, and server-side billing/entitlement rules must read the active catalog instead of hard-coded constants. | First-pass catalog editor, admin read/write routes, public billing-plan route, free-plan registration credit grant, board/page gating and Team/Group lifecycle wiring are implemented locally |
| Developer AI control | Admin/developer operators can inspect and edit model, provider-route and pricing facts with versioned publish/rollback. | First-pass stable |
| Team purchase | Buying Team Start/Growth creates a new Team workspace, owner membership, Team wallet, subscription and seat capacity. | Backend checkout/complete contract, hosted checkout response contract, provider-neutral checkout adapter, optional Stripe Checkout Session first cut, minimal frontend redirect wiring, signed webhook inbox and local manual/hosted smoke implemented; deployed staging smoke pending |
| Team seats | Team owners/admins can invite members, assign/remove roles, buy/add seats and remove members. Initial purchase need not max out the plan cap. | Backend seat mutation, invite accept seat-capacity enforcement and member removal first cuts implemented; frontend invite/remove/role update/seat assignment plus `/usage` buy-seat checkout wiring implemented with owner/admin gating |
| Team wallet | Included seat credits and Team top-ups land in the Team wallet. Team AI runs charge that wallet, not each member's personal account. | Backend entitlement/quote, Team top-up contract and signed webhook inbox with provider metadata lookup implemented; UI polish pending |
| Group/Collaborate | A user can hold one active Collaborate plan at a time. Group members share Boards, while AI usage charges each actor's personal wallet. | Backend Collaborate checkout and Group create first cut implemented; minimal frontend create/invite wiring implemented |
| Invites | Team and Group support invite links, invite acceptance, expiration/revoke and member role assignment. | Backend workspace invite link create/accept/revoke/expiry first cut implemented; dashboard invite link, revoke, member role and Team seat actions are wired; email pending |
| Permissions | Board `Can view/edit/manage/Owner` stays separate from workspace admin/editor/viewer and separate from AI payer eligibility. | First-pass resolver exists; Group/Team hardening pending |
| Billing usage | Users can see personal wallet, credits, ledger, usage and top-ups. Team admins can see Team wallet, seat costs, member usage and usage by Board/model. | First-pass `/billing`, `/team`, `/usage` exists; `/usage` Team top-up, seat checkout, personal top-up and Group create buttons now call real routes; `/admin` is now tabbed into Overview, Users, Teams, Groups, AI API Routes, Finance and Access, can inspect payment, wallet, subscription, ledger and Team member usage facts, and developer admins can manually top up, deduct or reassign user/Team wallets |
| Payment lifecycle | Checkout, webhook grants, renewals, cancellation, invoices, top-ups and seat additions are durable and auditable. | Hosted checkout response contract, provider-neutral checkout adapter, optional Stripe Checkout Session first cut, frontend success/cancel return routes, missing-config guard, signed webhook inbox, admin finance reconciliation, audited `admin_manual` plan/top-up/cancel/delete operations and local manual/hosted payment smoke exist; deployed staging smoke plus renewals/invoices/refunds pending |
| AI charge transparency | Every AI run explains user, workspace/team, board, node, model, pricing rule, provider route, charged account and provider cost. | S2/S3 scaffolds exist; GeekAI fast path still needs reconciliation |

## Current First Pass To Reuse

- Server-gated `/admin`, audit logs, admin finance reconciliation panels and owner-only global-admin role mutation.
- Admin directory APIs and tabbed developer console for registered users, Team dashboards, Group dashboards, AI API route metrics, finance reconciliation and access control.
- First-pass `/billing`, `/team` and `/usage` UI surfaces.
- `workspace.kind`, workspace members, seat assignments, usage rollups and dashboard snapshots.
- `credit_accounts`, `credit_ledger`, internal grant/top-up/usage/refund/admin-adjustment helpers.
- Payment checkout/complete scaffolds for top-ups and seat capacity, hosted checkout response metadata and missing-config guard for non-manual providers, provider-neutral checkout adapter with optional Stripe Checkout Session support, amount/currency/kind/client-reference handoff metadata, plus a signed webhook inbox that reuses the payment completion/grant path by payment id, client reference or provider metadata checkout session id.
- Admin finance reconciliation first pass with payment, wallet, subscription, credit ledger and Team member usage read APIs plus matching frontend panels and audited manual operations for user wallet top-up/deduction, Team wallet top-up/deduction, Collaborate/Group plan assignment, Team plan assignment, Team/Group creation, subscription cancellation and workspace deletion. Manual plan windows use `effectMode` plus `durationCount * durationUnitDays`, and every manual write requires an operation reason for audit.
- Admin operator console redesign contract is now locked from the operator mock. First-pass fast inventory rows, one-call detail bundle, five local detail tabs, joined Team/Group rows, unified payment-ledger-subscription-audit billing history, centered manual-finance modals, user block/unblock/delete, subscription freeze/unfreeze, inline pending invite rows and joined Team/Group role-remove actions now exist; local demo-rich QA can now be seeded on demand, while higher-volume/staging operator readiness still remains.
- Operator detail tables now also support arbitrary workspace `Invite` and `Add member` actions plus board `Copy` / `Delete` actions through native admin routes, so developer admins no longer need to impersonate the end-user workspace shell for those operations.
- Joined Team and Joined Group now also support search-backed `Join Team` / `Join Group` modals, so developer admins can place a user into an existing workspace from the detail view without typing raw workspace ids.
- `/admin` should open with a real active-tab seed instead of an empty shell, and later top-level tab switches should stay client-hot after the first warm pass.
- The AI API Routes tab should use the same dense admin layout language as User inventory: table-first route inventory, toolbar search/filter controls, one selected route detail form, separate image/text/video consumption tables and a full-width grouped API call ledger by `runId` with inline attempt inspection, without explanatory helper copy.
- AiRun charge fields, quote/preflight, runtime facts, `ai_api_calls`, provider-cost facts and admin AI route/pricing panels.
- Board permission resolver, owner-only copy/delete, share links, people lookup and Board member management.

## Product Rule Drift To Fix

The older S3 strategy treated Team Start/Growth as governance plus member-personal seat credits. That is now superseded.

Required rework:

1. Team payer resolver: Team workspaces charge a workspace-owned Team wallet.
2. Team subscription lifecycle: Team purchase creates the Team workspace and wallet. Backend contract first cut, hosted checkout response contract, provider-neutral checkout adapter, optional Stripe Checkout Session first cut, signed webhook inbox and local manual/hosted payment smoke implemented; deployed staging smoke and UI polish remain.
3. Seat grants: seat capacity and member assignment do not create per-member payer accounts; seat purchases grant included credits into Team wallet.
4. Team top-up: Team top-ups credit the Team wallet. Backend contract and signed webhook inbox with provider metadata lookup implemented; UI polish pending.
5. Collaborate constraint: a user can have one active Collaborate subscription, Start or Plus. Backend checkout/upsert first cut implemented.
6. Group privacy: Group admins manage collaboration structure, not other users' billing.
7. AiRun attribution: every production run stores actor, workspace/team, board, node, charged account, pricing rule and provider route before provider execution.

## Acceptance

- A user can buy multiple independent Teams; Team A wallet, members, Boards and ledger never leak into Team B.
- A Team purchase creates `team_workspace`, owner/admin membership, Team wallet, subscription and initial seat capacity in one auditable flow.
- A Team can start below the seat cap and add seats later.
- Each paid seat contributes included credits to the Team wallet according to the active plan.
- Team owner/admin can invite, accept, remove and role-manage members as admin/editor/viewer.
- Team owner/admin can see Team wallet balance, top-ups, seat capacity, member usage, Board usage and billing usage.
- Admin finance roles can reconcile payment status, wallet balances, subscriptions, credit ledger rows and Team member usage from one developer console, and owner/admin/finance roles can manually assign plans, top up credits, deduct credits or delete subscriptions/workspaces while Stripe is unavailable.
- Group/Collaborate members can share and edit Boards according to role, but each member's AI usage charges their own personal wallet.
- A user can have only one active Collaborate subscription at a time.
- Personal billing never exposes another Group member's wallet, usage, invoices or top-ups.
- AI runs fail before provider execution if the actor lacks Board permission, payer eligibility or balance.
- Admin/developer views can explain every run by user, workspace/team, board, node, model, route, pricing rule, charged account, credits and provider cost.
- Developer admins can navigate users, Teams and Groups separately, enter focused manual top-up/deduct/plan/delete actions from the relevant detail view, and see AI image/text provider-route usage from one route-management tab.
- Developer admin inventory/detail screens should be dense, table-first and modal-driven, not card-heavy or helper-text heavy.
- Developer admin can edit the subscription catalog from Finance, and those plan values drive registration credits, board/page limits, group caps, pricing and included-credit math in the backend.
- The User inventory is the primary developer-admin surface: one row per user with email, IP/registration facts, active and expired Team plans, Team credit bars, active and expired Collaborate/Group plans, personal credit, lifetime spent credits, block state and detail action.
- The User detail surface has five local tabs after one bundle load: Billing, Team Plan, Joined Team, Group Plan and Joined Group. Tab switching must not perform a new access check or refetch.
- Pending Team/Group invites should appear inline in the same detail rows as members, and invite/member/board row actions should reflect immediately from the returned mutation payload whenever a full detail refetch is not needed.
- Billing actions are modal-driven and reason-required: block/unblock, soft-delete account, top up, deduct, assign/change plan, freeze/unfreeze or delete plan/workspace.
- Team rows expose plan period, workspace name, Team wallet bar, members, boards, seats, freeze/unfreeze, top-up, deduct, buy seats and delete. Team Start/Growth seat caps remain 15 per Team workspace until the catalog changes.
- Group/Collaborate rows enforce one active Collaborate plan per user, Collaborate Start up to 10 Groups, Collaborate Plus up to 20 Groups, and max 15 members per Group. Group admin manages structure only; billing remains personal to the actor.

## Non-Goals For This Slice

- No production collaboration/Yjs.
- No marketplace.
- No fake unlimited AI.
- No frontend-held provider keys or frontend-selected raw provider routes.
- No enterprise SSO/SCIM before Team/Group wallets and Auth boundaries are stable.

## Next Active Plan

Implementation should follow `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md`.
