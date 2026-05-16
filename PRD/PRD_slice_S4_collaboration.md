# PRD Slice S4: Collaboration

**Updated**: 2026-05-16
**Status**: Planned next slice after the current S1/S2/S3 acceptance gates. Production multiplayer is still outside the current release promise, but the role language, invite boundary and first collaboration rollout order are now explicitly locked.

## Goal

Enable multiple users to edit the same Board without breaking Asset, Board, Auth or AiRun authority boundaries.

## Stabilization Rule

Keep this slice outside the current release promise until the signed-in browser, Google/email and live AI gates are closed. Planning, schema alignment and a bounded first implementation plan are allowed now because invite/member/role boundaries affect billing and account-deletion behavior too.

## Product Requirements

| Area | Requirement |
| --- | --- |
| Invite lifecycle | Team and Group invite links are the first entry point into collaboration. A collaborator should be able to join through an invite link before live cursor work is considered complete. |
| Workspace roles | `owner/admin/editor/viewer` are the canonical collaboration roles shown in product UI. Legacy `member/guest` may remain as compatibility values internally, but new UX should not introduce them as primary labels. |
| Board roles | Board roles support `owner/admin/editor/viewer/temporary_viewer`; board ownership and board delete/copy stay stricter than workspace membership. |
| Presence | Users can see collaborators, names, cursors, active page and lightweight activity. |
| Realtime edit | Shape movement, drawing and lightweight Board document updates sync in real time. |
| Conflict rule | Most canvas edits are optimistic and mergeable, but focused text/node-parameter editing should show occupancy so two users cannot enter the same sensitive edit mode at the same time. |
| Soft locks | Editing sensitive node params can show soft occupancy and temporary input lock. |
| Snapshots | Board History remains recoverable under collaboration. |
| Authority | AI runs, credit charges, Asset writes and permissions remain server-authoritative. |

## Non-Goals For P0

- No collaboration before Auth, Board CRUD, Asset storage and AiRun boundaries are stable.
- No CRDT storage of images, provider payloads or long logs.

## Readiness Note

S1X keeps Yjs viability open, but production collaboration remains P0.5. The current bridge already has a provider-shaped websocket room plus reconnect/resync acceptance harness, yet it is still not the final production provider. The first proof should keep using Konva v2 `CanvasDocument` plus `pages[]`, store only lightweight shapes/runtime edges/Asset refs in the CRDT, and leave AI runs, credits, Asset writes and permission checks server-authoritative.

## First Rollout Order

1. Reuse the existing Team/Group invite-link contracts and canonicalize visible role language around `owner/admin/editor/viewer`.
2. Let invited users open the same workspace/Board through real membership and permission checks.
3. Add Miro-style live presence: cursor, name, active page and current tool.
4. Add sensitive-edit occupancy for text-like and node-parameter editing, so a second user cannot enter the same focused edit mode at the same time.
5. Keep free drawing, shape move and page edits optimistic/mergeable instead of globally locking the whole Board.
