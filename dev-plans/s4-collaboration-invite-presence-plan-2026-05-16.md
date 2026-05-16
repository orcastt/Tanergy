# S4 Collaboration Invite/Presence Plan

**Created**: 2026-05-16
**Status**: In progress. Invite -> board entry is now wired in product UI, invite history now has explicit `pending / accepted / revoked` states, Team owner transfer has a first safe product/backend cut, and real signed-in two-user smoke remains the next acceptance pass.
**Owner slice**: S4, with S1D/S3 dependencies.

## Goal

Start collaboration from real Team/Group membership, then layer live presence and optimistic sync on top without breaking Board permission, billing or account-deletion boundaries.

Target order:

```text
invite link + membership
  -> canonical roles
  -> live cursors/presence
  -> sensitive-edit occupancy
  -> optimistic multi-user board sync
```

## Reuse, Do Not Rebuild

- `tangent_workspace_invitations`
- `tangent_workspace_members`
- `tangent_board_members`
- existing Team/Group invite create/accept/revoke routes
- existing board permission resolver
- existing websocket/Yjs room bridge

## Phase 0: Boundary Cleanup

- Record the paid-account deletion rule before scaling collaboration:
  - solo/free-only users may self-delete immediately
  - users still attached to paid Team/Group structures must transfer, leave, cancel or clear blockers first
- Keep canonical visible workspace roles at `owner/admin/editor/viewer`
- Keep board roles at `owner/admin/editor/viewer/temporary_viewer`
- Treat legacy `member/guest` as compatibility-only values during migration

Exit criteria:

- Docs, product language and backend expectations all point to one role matrix
- Account deletion blocker expansion is documented before deeper collaboration work

## Phase 1: Invite-Link Product Path

- Reuse the existing Team/Group invite contracts in the real workspace UI
- Make invite accept land the user in the correct workspace and board shell
- Expose revoke/copy/open actions from the workspace/member surfaces
- Keep invite-manager authority at workspace `owner/admin`
- Keep paid-workspace governance believable: Team ownership transfer must exist before paid self-exit feels complete; Group owner transfer remains blocked until billing ownership rules are explicit
- Current implementation note:
  - invite links may now carry optional `boardId` / `boardTitle`
  - accept may land directly on `/boards/[boardId]?workspace=...`
  - Team/Group dashboard board cards now open the real board route
  - `services/api/scripts/s4_workspace_invite_smoke.py` now covers the owner-create -> invite -> accept -> reopen-board API path

Exit criteria:

- An invited user can accept a Team/Group invite and reopen the same workspace through real membership
- Workspace role is visible and consistent after acceptance
- Invite history states are visible and distinguishable as `pending / accepted / revoked`

## Phase 2: Live Presence

- Use Yjs awareness for:
  - cursor
  - display name
  - active page
  - current tool
  - selected ids
  - focused editing ids
- Render Miro-style remote cursors and lightweight presence badges

Exit criteria:

- Two signed-in users can open the same Board and see each other's cursor/name/page presence
- The current page-scoped collaboration claim has been exercised on a real multi-page Board, not only local smoke

## Phase 3: Sensitive-Edit Occupancy

- Add occupancy for text-like and node-parameter editing
- Block a second user from entering the same focused edit mode while the first editor is active
- Keep occupancy lease-based and awareness-driven; no persistent lock table for this cut

Exit criteria:

- A second user sees "occupied" state and cannot enter the same node-param/text editor until release or timeout

## Phase 4: Optimistic Sync

- Keep draw/move/page operations optimistic and mergeable
- Do not globally lock the whole Board
- Preserve server authority for:
  - permissions
  - AI runs
  - credits
  - asset writes
  - snapshots
  - destructive board/workspace operations

Exit criteria:

- Two signed-in users can draw/move/edit the same Board with presence and without global lock regressions

## Risks

- Role drift between legacy `member/guest` and canonical `editor/viewer`
- Collaboration shipping before delete/invite/member boundaries are fully believable
- Over-locking the canvas and making ordinary movement feel worse than single-player editing

## Validation

- Invite accept/revoke/open smoke with two real signed-in users
- Two-user cursor visibility smoke
- Two-user sensitive-edit occupancy smoke
- Two-user optimistic draw/move smoke
