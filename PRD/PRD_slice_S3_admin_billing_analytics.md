# PRD Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-18
**Mode**: Product slice.
**Status**: Active commercial-architecture slice. Existing admin, ledger, seat and AI-control-plane scaffolds remain useful, but the Team charging rule has pivoted from member-personal credits to a Team wallet. Real staging session/admin smoke is now green; public pricing and draft legal/policy pages now exist without Auth; the next release-facing gates are live AI/payment depth, legal/compliance finalization, Google/email verification and broader browser acceptance.

## Goal

Make Team, Group/Collaborate, wallets, seats, invites, usage, billing and admin monitoring coherent before real provider charging and payment automation become production authority.

## 2026-05-08 Product Decision

Team and Group are different commercial products:

| Area | Team Start / Team Growth | Group / Collaborate Start / Collaborate Plus |
| --- | --- | --- |
| Purchase creates | A new isolated `team_workspace` | A personal plan state. `free_canvas` already includes one free Group create, while Collaborate Start/Plus expand personal Group capacity and credits. |
| Multiplicity | One user may own or belong to multiple Teams | One user may have only one active Collaborate subscription: Start or Plus, while `free_canvas` still retains its single free Group create allowance |
| Credit owner | Team wallet, modeled as a workspace-owned credit account | Personal wallet, modeled as a user-owned credit account |
| Included credits | Seat purchase grants credits into the Team wallet total account | Subscription grants credits into the paying user's personal wallet |
| Top-up | Team top-up adds credits to the Team wallet | Personal top-up adds credits to the user wallet |
| AI charge in workspace | Team Board runs charge the Team wallet after permission/preflight | Group Board runs charge the acting user's personal wallet |
| Member billing visibility | Team owner/admin can see Team wallet, seat capacity, member usage and Board usage | Group admin manages members/Boards but cannot see another member's credit balance, billing usage or invoices |
| Member roles | Workspace admin/editor/viewer plus Board roles | Workspace admin/editor/viewer plus Board roles |

Enterprise may later use a contract-defined workspace pool, but it is not the alpha default.

## 2026-05-16 Confirmed Policy Baseline

The Team / Group / Billing / Invite foundation is now explicitly confirmed before deeper Yjs collaboration work:

- Free users cannot create Teams, but may join existing Teams when the target Team has remaining seat capacity.
- Free users may create exactly one Group and may still join other existing Groups.
- Group is a collaboration structure, not a shared wallet. Group AI always charges the acting user's personal credits.
- Team is a paid workspace product. Team AI always charges the Team wallet.
- Invite acceptance checks target workspace validity and capacity only. It must not reject a user simply for being on the free personal tier.
- Group member limit is currently 15 across personal plans.
- `free_canvas` keeps the strict free-collaboration envelope: one created Group, that Group capped at one Board, and each Board capped at three Pages.
- Collaborate Start and Collaborate Plus expand personal Group count and personal included credits only. They do not create a Group-owned credit pool.
- Personal-plan annual pricing is the annual-term monthly rate billed as `annual price × 12` upfront for a 365-day term.
- Team included credits stay seat-based: Team Start grants `2500 credits / seat`, Team Growth grants `5500 credits / seat`.
- Team Start / Team Growth pricing is also seat-based: monthly pricing is per seat per month, while annual pricing is the per-seat annual-term monthly rate that is billed as `annual price × 12 × seat count` upfront for a 365-day term.
- Subscription included credits are cycle-scoped: they start from payment completion, refresh every 30 days, and unused included credits do not roll over into the next cycle.
- Upgrade grants must preserve existing top-up balances and add only the included-credit delta for the new plan.
- Group product surfaces should describe billing as `My personal plan` / `My credits`, not `Group subscription`.

## Product Requirements

| Area | Requirement | Current status |
| --- | --- | --- |
| Admin access | `/admin` is server-gated through `admin_roles`; all admin writes are audited. | First-pass stable |
| Admin operator console | Developer admin views are inventory-first and detail-bundle-first: user inventory, one-call user detail, Billing / Team Plan / Joined Team / Group Plan / Joined Group tabs, modal actions and no explanatory helper copy. Owned Team/Group rows must support developer-side invite/add-member actions, board rows must support admin copy/delete, pending invites should be visible inline in the same row stack as members, Joined Team / Joined Group must let developer admin place a user into an existing workspace through searchable modal lookup, and top-level Team/Group dashboards must support real search/pagination for larger inventories. | First-pass operator read model, inventory table, detail tabs, unified billing history, manual-finance modals, user status writes, subscription freeze/unfreeze, arbitrary workspace invite/add-member actions, inline pending invite rows, row-level local detail patching for invite/member/board actions, board copy/delete actions, searchable Join Team/Join Group modals, server-seeded first-open detail, background-warmed top-level tabs, paginated Team/Group dashboards and an opt-in demo seed for dense local QA are implemented locally; higher-volume/staging operator smoke remains |
| Plan catalog | The Finance tab is the operations-owned subscription catalog. Developer admins must be able to adjust personal-plan and workspace-plan monthly price, annual price, included credits and registration credits as market conditions change, and may also edit board limits, page limits, group caps and seat caps. Personal annual checkout charges `annual price × 12` upfront for a 365-day term. For Team plans, both monthly and annual prices are per-seat inputs; annual checkout charges `annual price × 12 × seat count` upfront for a 365-day term. Server-side billing, entitlement, invite-capacity and checkout rules must read the active catalog instead of hard-coded constants. | First-pass catalog editor, admin read/write routes, public billing-plan route, free-plan registration credit grant, board/page gating and Team/Group lifecycle wiring are implemented locally |
| Developer AI control | Admin/developer operators can inspect and edit model, provider-route and pricing facts with versioned publish/rollback. | First-pass stable |
| Team purchase | Buying Team Start/Growth creates a new Team workspace, owner membership, Team wallet, subscription and seat capacity. | Backend checkout/complete contract, hosted checkout response contract, provider-neutral checkout adapter, optional Stripe Checkout Session first cut, minimal frontend redirect wiring, signed webhook inbox and local manual/hosted smoke implemented; deployed staging smoke pending |
| Team seats | Team owners/admins can invite members, assign/remove roles, buy/add seats and remove members. Initial purchase need not max out the plan cap. | Backend seat mutation, invite accept seat-capacity enforcement and member removal first cuts implemented; frontend invite/remove/role update/seat assignment plus `/usage` buy-seat checkout wiring implemented with owner/admin gating |
| Team wallet | Included seat credits and Team top-ups land in the Team wallet. Team AI runs charge that wallet, not each member's personal account. | Backend entitlement/quote, Team top-up contract and signed webhook inbox with provider metadata lookup implemented; UI polish pending |
| Group/Collaborate | Free Canvas users may create one Group and join other existing Groups. Collaborate Start/Plus expand personal Group count and personal credits only. Group members share Boards, while AI usage always charges each actor's personal wallet and never a Group-owned wallet. | Backend Collaborate checkout and Group create first cut implemented; minimal frontend create/invite wiring implemented |
| Invites | Team and Group support invite links, invite acceptance, expiration/revoke and member role assignment. | Backend workspace invite link create/accept/revoke/expiry first cut implemented; dashboard invite link, revoke, member role and Team seat actions are wired; email pending |
| Workspace member management | Team/Group management must cover invite create/revoke/accept, add member, remove member, role change, Team seat assign/revoke, admin lookup-based Join Team/Join Group, and Team-only owner transfer. | First-pass backend and admin operator contracts exist locally; Group owner transfer remains intentionally blocked |
| Account deletion | Self-delete must remain available for privacy compliance, but Team/Group relationships, seat assignments, active subscriptions and invite ownership cannot be orphaned. Solo/free-only users may delete immediately; users with active Team/Group ownership, joined Team/Group memberships, seat assignments, subscription obligations or still-owned pending invites must first transfer, leave, cancel or clear those bindings. | Shared hard-delete now uses a structured `409 account_delete_blocked` response for self-delete and admin delete, with first-pass blockers for owned Team/Group workspaces, joined Team/Group memberships, active Team seats, active subscriptions and orphaned invites; the next hardening cut is UI/detail rendering plus broader real-account smoke |
| Permissions | Board `Can view/edit/manage/Owner` stays separate from workspace admin/editor/viewer and separate from AI payer eligibility. | First-pass resolver exists; Group/Team hardening pending |
| Billing usage | `Usage` is the status-and-consumption surface: users can see active personal plan state, active Team workspace plan state, wallet balances, credits, ledger, usage and top-ups. Team admins can also see Team wallet, seat costs, member usage and usage by Board/model. | First-pass `/billing`, `/team`, `/usage` exists; `/usage` Team top-up, seat checkout, personal top-up and Group create buttons now call real routes; `/admin` is now tabbed into Overview, Users, Teams, Groups, AI API Routes, Finance and Access, can inspect payment, wallet, subscription, ledger and Team member usage facts, and developer admins can manually top up, deduct or reassign user/Team wallets |
| Public pricing | Visitors must be able to inspect subscription positioning before registration. `/pricing` should be public, linked from the landing page, and use narrow long-form plan containers rather than a full-width card spread. It must state the beta/commercial-readiness boundary and avoid starting live checkout until payment, tax, invoice, refund and legal review are ready. | Public `/pricing` first pass exists with no-auth access, landing links and beta/waitlist CTAs. It currently uses the frontend catalog; if admin-edited pricing must become market-authoritative before launch, the page should read the backend public plan catalog. |
| Legal and AI policy pages | Public Privacy Policy, Terms of Service and AI Content Policy pages should exist before paid launch, cover beta status, data handling, AI providers, ownership, prohibited content, moderation, deletion and payment-readiness boundaries, and be linked from the landing/footer. | Draft `/privacy`, `/terms` and `/ai-policy` pages exist. Final company/operator details, support contact, subprocessor list and legal review remain pending. |
| Billing / subscription UI | The authenticated product should expose two primary billing-related tabs: `Subscription` and `Usage`. `Subscription` is the plan-catalog and purchase surface and may continue to use the existing `/billing` route in the near term; `Usage` is the current-plan and consumption surface. `Subscription` and `Usage` must each use vertically stacked long-form containers. The visual model should follow a Lovart-like vertical pricing narrative, but without modal-first plan explainers: each long container must directly expose price or status, current period, valid until, next refresh, credits, limits, permission summary, Group/Team capacity facts, and direct CTA. Personal containers must show Group create cap plus solo/free-Group board-page limits; Team containers must show seat pricing, seat usage, Team wallet facts and Team board/member facts. | Public no-auth pricing now follows the long-container direction; authenticated `/billing` and `/usage` still need the next product-surface pass against live plan/usage read models. |
| Payment lifecycle | Checkout, webhook grants, renewals, cancellation, invoices, top-ups and seat additions are durable and auditable. | Hosted checkout response contract, provider-neutral checkout adapter, optional Stripe Checkout Session first cut, frontend success/cancel return routes, missing-config guard, signed webhook inbox, admin finance reconciliation, audited `admin_manual` plan/top-up/cancel/delete operations and local manual/hosted payment smoke exist; deployed staging smoke plus renewals/invoices/refunds pending |
| AI charge transparency | Every AI run explains user, workspace/team, board, node, model, pricing rule, provider route, charged account and provider cost. | S2/S3 scaffolds exist; GeekAI-first fast path still needs reconciliation |

## Current First Pass To Reuse

- Server-gated `/admin`, audit logs, admin finance reconciliation panels and owner-only global-admin role mutation.
- Admin directory APIs and tabbed developer console for registered users, Team dashboards, Group dashboards, AI API route metrics, finance reconciliation and access control.
- First-pass `/billing`, `/team` and `/usage` UI surfaces.
- `workspace.kind`, workspace members, seat assignments, usage rollups and dashboard snapshots.
- `credit_accounts`, `credit_ledger`, internal grant/top-up/usage/refund/admin-adjustment helpers.
- Payment checkout/complete scaffolds for top-ups and seat capacity, hosted checkout response metadata and missing-config guard for non-manual providers, provider-neutral checkout adapter with optional Stripe Checkout Session support, amount/currency/kind/client-reference handoff metadata, plus a signed webhook inbox that reuses the payment completion/grant path by payment id, client reference or provider metadata checkout session id.
- Admin finance reconciliation first pass with payment, wallet, subscription, credit ledger and Team member usage read APIs plus matching frontend panels and audited manual operations for user wallet top-up/deduction, Team wallet top-up/deduction, Collaborate/Group plan assignment, Team plan assignment, Team/Group creation, subscription cancellation and workspace deletion. Manual plan windows use `effectMode` plus `durationCount * durationUnitDays`, and every manual write requires an operation reason for audit.
- The Finance catalog is now intended as the market-facing control plane for pricing and grant policy: monthly/annual price, included credits, registration credits and capacity limits should all be editable there, with the runtime reading those values live.
- The next billing/product-surface pass should present `Subscription` as the plan-catalog/compare/purchase surface and `Usage` as the active-plan/consumption surface. Both should use vertical long-form containers and surface current period, valid-until and next-refresh facts directly in those blocks.
- Public pricing is now also part of the product surface: `/pricing` must stay reachable before registration, show beta/waitlist language while live checkout is disabled, and should eventually read the backend public plan catalog if admin-edited prices become launch-authoritative.
- Privacy, Terms and AI Content Policy drafts now exist as public pages, but final operator details and legal/compliance review are still required before live paid launch.
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
- Personal annual checkout charges `annual price × 12` upfront for a 365-day term.
- Team monthly checkout charges `monthly price per seat × seat count`, while Team annual checkout charges `annual price per seat × 12 × seat count` upfront for a 365-day term.
- Subscription included credits refresh every 30 days from payment completion and do not roll over unused included credits into the next cycle.
- Team owner/admin can invite, accept, remove and role-manage members as admin/editor/viewer.
- Team owner/admin can see Team wallet balance, top-ups, seat capacity, member usage, Board usage and billing usage.
- Admin finance roles can reconcile payment status, wallet balances, subscriptions, credit ledger rows and Team member usage from one developer console, and owner/admin/finance roles can manually assign plans, top up credits, deduct credits or delete subscriptions/workspaces while Stripe is unavailable.
- Group/Collaborate members can share and edit Boards according to role, but each member's AI usage charges their own personal wallet.
- Free users can join existing Team and Group workspaces when the target workspace still has capacity and the invite is valid.
- Free users can create exactly one Group; that free-owned Group is capped at one Board with three Pages per Board.
- A user can have only one active Collaborate subscription at a time.
- Invite acceptance is gated by invite validity plus Team seat or Group member capacity, not by the invitee's personal plan tier.
- Personal billing never exposes another Group member's wallet, usage, invoices or top-ups.
- Collaborate Start and Collaborate Plus expand personal Group count and personal credits only; they do not create any Group shared wallet behavior.
- AI runs fail before provider execution if the actor lacks Board permission, payer eligibility or balance.
- Admin/developer views can explain every run by user, workspace/team, board, node, model, route, pricing rule, charged account, credits and provider cost.
- Developer admins can navigate users, Teams and Groups separately, enter focused manual top-up/deduct/plan/delete actions from the relevant detail view, and see AI image/text provider-route usage from one route-management tab.
- Developer admin inventory/detail screens should be dense, table-first and modal-driven, not card-heavy or helper-text heavy.
- Developer admin can edit the subscription catalog from Finance, and those plan values drive registration credits, board/page limits, group caps, pricing and included-credit math in the backend.
- Developer admin can adjust monthly price, annual price, included credits and registration credits for personal and workspace plans from Finance, and those values immediately become the backend source of truth for commercial policy.
- The User inventory is the primary developer-admin surface: one row per user with email, IP/registration facts, active and expired Team plans, Team credit bars, active and expired Collaborate/Group plans, personal credit, lifetime spent credits, block state and detail action.
- The User detail surface has five local tabs after one bundle load: Billing, Team Plan, Joined Team, Group Plan and Joined Group. Tab switching must not perform a new access check or refetch.
- Pending Team/Group invites should appear inline in the same detail rows as members, and invite/member/board row actions should reflect immediately from the returned mutation payload whenever a full detail refetch is not needed.
- Team/Group member management must be complete enough for both operator and end-user flows: create/revoke invite, accept invite, add member, remove member, change role, Team seat assignment, admin Join Team/Join Group, Team owner transfer and explicit Group owner-transfer denial.
- `Usage` should show current period, valid-until and next-refresh state for each active Personal or Team plan/workspace block, while the `Subscription` page should separate Personal and Workspace offerings into vertically stacked comparison bands instead of hiding plan context in a modal.
- Personal plan bands should explicitly show Group create cap, Group member cap, solo board/page limits and the free-owned Group board/page envelope; Team plan bands should explicitly show seat pricing, current seats, seat cap, Team board count, Team member count and Team wallet charging semantics.
- Billing actions are modal-driven and reason-required: block/unblock, hard-delete account with ownership safety guards, top up, deduct, assign/change plan, freeze/unfreeze or delete plan/workspace.
- Self-delete is available in-product for privacy/compliance. A solo/free-only user can delete immediately, but a user still attached to paid Team/Group structures must first see explicit blockers such as owned Team/Group workspaces, joined paid workspaces, active seats or active subscriptions instead of a vague failure.
- Team rows expose plan period, workspace name, Team wallet bar, members, boards, seats, freeze/unfreeze, top-up, deduct, buy seats and delete. Team Start/Growth seat caps remain 15 per Team workspace until the catalog changes.
- Group/Collaborate rows enforce one active Collaborate plan per user, Collaborate Start up to 10 Groups, Collaborate Plus up to 20 Groups, and max 15 members per Group. Group admin manages structure only; billing remains personal to the actor.
- Group directory, detail and billing copy should use `My personal plan` / `My credits` language instead of presenting Group as a separate subscription wallet.

## Non-Goals For This Slice

- No production collaboration/Yjs.
- No marketplace.
- No fake unlimited AI.
- No frontend-held provider keys or frontend-selected raw provider routes.
- No enterprise SSO/SCIM before Team/Group wallets and Auth boundaries are stable.

## Next Active Plan

Implementation should follow `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md`.
