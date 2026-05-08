# PRD Slice S3: Team, Group, Wallets, Billing And Admin

**Updated**: 2026-05-08
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
| Developer AI control | Admin/developer operators can inspect and edit model, provider-route and pricing facts with versioned publish/rollback. | First-pass stable |
| Team purchase | Buying Team Start/Growth creates a new Team workspace, owner membership, Team wallet, subscription and seat capacity. | Schema and seat-checkout first cut exist; full Team purchase flow pending |
| Team seats | Team owners/admins can invite members, assign/remove roles, buy/add seats and remove members. Initial purchase need not max out the plan cap. | Seat mutation exists; wallet grant first cut now writes Team wallet |
| Team wallet | Included seat credits and Team top-ups land in the Team wallet. Team AI runs charge that wallet, not each member's personal account. | Entitlement/quote first cut implemented; Team top-up pending |
| Group/Collaborate | A user can hold one active Collaborate plan at a time. Group members share Boards, while AI usage charges each actor's personal wallet. | Database constraint exists; checkout/service hardening pending |
| Invites | Team and Group support invite links, invite acceptance, expiration/revoke and member role assignment. | Board invite first pass exists; workspace invite accept needs work |
| Permissions | Board `Can view/edit/manage/Owner` stays separate from workspace admin/editor/viewer and separate from AI payer eligibility. | First-pass resolver exists; Group/Team hardening pending |
| Billing usage | Users can see personal wallet, credits, ledger, usage and top-ups. Team admins can see Team wallet, seat costs, member usage and usage by Board/model. | First-pass `/billing`, `/team`, `/usage` exists; semantics must pivot |
| Payment lifecycle | Checkout, webhook grants, renewals, cancellation, invoices, top-ups and seat additions are durable and auditable. | Scaffold only |
| AI charge transparency | Every AI run explains user, workspace/team, board, node, model, pricing rule, provider route, charged account and provider cost. | S2/S3 scaffolds exist; GeekAI fast path still needs reconciliation |

## Current First Pass To Reuse

- Server-gated `/admin`, audit logs and owner-only global-admin role mutation.
- First-pass `/billing`, `/team` and `/usage` UI surfaces.
- `workspace.kind`, workspace members, seat assignments, usage rollups and dashboard snapshots.
- `credit_accounts`, `credit_ledger`, internal grant/top-up/usage/refund/admin-adjustment helpers.
- Payment checkout/complete scaffolds for top-ups and seat capacity.
- AiRun charge fields, quote/preflight, runtime facts, `ai_api_calls`, provider-cost facts and admin AI route/pricing panels.
- Board permission resolver, owner-only copy/delete, share links, people lookup and Board member management.

## Product Rule Drift To Fix

The older S3 strategy treated Team Start/Growth as governance plus member-personal seat credits. That is now superseded.

Required rework:

1. Team payer resolver: Team workspaces charge a workspace-owned Team wallet.
2. Team subscription lifecycle: Team purchase creates the Team workspace and wallet.
3. Seat grants: seat capacity and member assignment do not create per-member payer accounts; seat purchases grant included credits into Team wallet.
4. Team top-up: Team top-ups credit the Team wallet.
5. Collaborate constraint: a user can have one active Collaborate subscription, Start or Plus.
6. Group privacy: Group admins manage collaboration structure, not other users' billing.
7. AiRun attribution: every production run stores actor, workspace/team, board, node, charged account, pricing rule and provider route before provider execution.

## Acceptance

- A user can buy multiple independent Teams; Team A wallet, members, Boards and ledger never leak into Team B.
- A Team purchase creates `team_workspace`, owner/admin membership, Team wallet, subscription and initial seat capacity in one auditable flow.
- A Team can start below the seat cap and add seats later.
- Each paid seat contributes included credits to the Team wallet according to the active plan.
- Team owner/admin can invite, accept, remove and role-manage members as admin/editor/viewer.
- Team owner/admin can see Team wallet balance, top-ups, seat capacity, member usage, Board usage and billing usage.
- Group/Collaborate members can share and edit Boards according to role, but each member's AI usage charges their own personal wallet.
- A user can have only one active Collaborate subscription at a time.
- Personal billing never exposes another Group member's wallet, usage, invoices or top-ups.
- AI runs fail before provider execution if the actor lacks Board permission, payer eligibility or balance.
- Admin/developer views can explain every run by user, workspace/team, board, node, model, route, pricing rule, charged account, credits and provider cost.

## Non-Goals For This Slice

- No production collaboration/Yjs.
- No marketplace.
- No fake unlimited AI.
- No frontend-held provider keys or frontend-selected raw provider routes.
- No enterprise SSO/SCIM before Team/Group wallets and Auth boundaries are stable.

## Next Active Plan

Implementation should follow `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md`.
