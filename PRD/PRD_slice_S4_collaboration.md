# PRD Slice S4: Collaboration

**Updated**: 2026-05-16
**Status**: In progress first slice. Production multiplayer is still outside the current release promise, but the invite-entry product path and first presence polish are now starting inside the real app shell.

## Goal

Enable multiple users to edit the same Board without breaking Asset, Board, Auth or AiRun authority boundaries.

## Stabilization Rule

Keep this slice outside the current release promise until the signed-in browser, Google/email and live AI gates are closed. Planning, schema alignment and a bounded first implementation plan are allowed now because invite/member/role boundaries affect billing and account-deletion behavior too.

## 2026-05-16 Foundation Gate

Before deeper Yjs behavior is promised, the Team / Group / Billing / Invite baseline must stay fixed:

- invite accept is resolved from invite validity plus target workspace capacity/state, not from whether the invitee is free or paid
- free users may join Team and Group workspaces if the target workspace has capacity
- Team owner transfer is the first supported ownership-transfer path
- Group owner transfer remains blocked until billing-owner semantics are explicitly designed
- Group collaboration continues to use actor-personal credits, while Team collaboration uses the Team wallet

## Product Requirements

| Area | Requirement |
| --- | --- |
| Invite lifecycle | Team and Group invite links are the first entry point into collaboration. A collaborator should be able to open a real invite page, continue through sign-in/sign-up if needed, and join through that link before live cursor work is considered complete. Invite acceptance depends on invite validity plus Team seat or Group member capacity, not on the invitee's personal plan tier. |
| Workspace roles | `owner/admin/editor/viewer` are the canonical collaboration roles shown in product UI. Legacy `member/guest` may remain as compatibility values internally, but new UX should not introduce them as primary labels. |
| Workspace ownership | Paid Team governance needs a user-visible ownership-transfer path before self-delete or paid-membership exit feels complete. The first safe product cut is Team-only owner transfer to an existing member; Group transfer remains explicitly blocked until billing ownership rules are defined. |
| Board roles | Board roles support `owner/admin/editor/viewer/temporary_viewer`; board ownership and board delete/copy stay stricter than workspace membership. |
| Presence | Users can see collaborators, names, cursors, active page and lightweight activity. Presence colors should distinguish different live sessions, not just different user ids, so the same user on two tabs/devices is still readable. Current-tool, page context and lightweight node-connection intent should be visible in the board shell/canvas rather than hidden only in hover affordances. The board header should also expose a compact live roster so active collaborators, roles and current activity can be inspected without hunting across the canvas. |
| Realtime edit | Shape movement, drawing and lightweight Board document updates sync in real time. |
| Conflict rule | Most canvas edits are optimistic and mergeable, but focused text/node-parameter editing should show occupancy so two users cannot enter the same sensitive edit mode at the same time. This focused-edit rule currently covers text edit, crop, node parameter dropdowns and chat model selection. |
| Soft locks | Editing sensitive node params can show soft occupancy and temporary input lock. If a second user tries to enter the same focused mode, the denial should be visible inside the canvas shell rather than only in a distant toolbar/status area. |
| Snapshots | Board History remains recoverable under collaboration. |
| Authority | AI runs, credit charges, Asset writes and permissions remain server-authoritative. |

## Non-Goals For P0

- No collaboration before Auth, Board CRUD, Asset storage and AiRun boundaries are stable.
- No CRDT storage of images, provider payloads or long logs.

## Readiness Note

S1X keeps Yjs viability open, but production collaboration remains P0.5. The current bridge already has a provider-shaped websocket room plus reconnect/resync acceptance harness, yet it is still not the final production provider. The first proof should keep using Konva v2 `CanvasDocument` plus `pages[]`, store only lightweight shapes/runtime edges/Asset refs in the CRDT, and leave AI runs, credits, Asset writes and permission checks server-authoritative.

## First Rollout Order

1. Keep the confirmed Team/Group/Billing/Invite baseline fixed, then reuse the existing Team/Group invite-link contracts and canonicalize visible role language around `owner/admin/editor/viewer`.
2. Give invite links a real product landing page so copy/paste links are human-usable, not raw API accept endpoints.
3. Let sign-in/sign-up preserve invite continuation and land the user back on the invite accept page.
4. Add first-pass Miro-style live presence polish: cursor, name and per-session color identity.
5. Let invited users open the same workspace/Board through real membership and permission checks.
6. Add sensitive-edit occupancy for text-like and node-parameter editing, so a second user cannot enter the same focused edit mode at the same time. The current first pass now includes text edit, crop, node parameter dropdowns and chat model selection.
7. Keep free drawing, shape move and page edits optimistic/mergeable instead of globally locking the whole Board.
8. Validate the page-scoped collaboration claim with real two-user Board smoke before broadening the product promise beyond this first slice.
