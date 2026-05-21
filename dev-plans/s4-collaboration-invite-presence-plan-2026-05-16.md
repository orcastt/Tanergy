# S4 Collaboration Invite/Presence Plan

**Created**: 2026-05-16
**Status**: In progress. Invite -> board entry is now wired in product UI, invite history now has explicit `pending / accepted / revoked` states, Team owner transfer has a first safe product/backend cut, the board route now requests session context for the target workspace instead of relying on stale active-session selection, presence wording now reads in more product-facing page/activity language, and local S4 contract/smoke coverage now spans invite accept, collaboration session claim/list/release and websocket reconnect/resync. Real signed-in two-user browser smoke remains the next acceptance pass.
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
  - the board route now rehydrates session access against that `workspace` query target before loading the board, so accept-to-board does not depend on the previous active workspace cache winning the race
  - Team/Group dashboard board cards now open the real board route
- `services/api/scripts/s4_workspace_invite_smoke.py` now covers the owner-create -> invite -> accept -> reopen-board API path
- `services/api/scripts/s4_collaboration_presence_smoke.py` now extends that path into owner/invitee collaboration session claim/list/release presence roundtrips for both Team and Group workspaces
- `services/api/scripts/s4_collaboration_readiness.py` now chains invite, presence and realtime smoke into one preflight entrypoint for the test phase

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
- Current slimming note before deeper realtime work:
  - `useKonvaLocalYjsSync.ts` has now been split into:
    1. `konvaLocalYjsSnapshotFlow.ts`
    2. `useKonvaLocalYjsPublishScheduler.ts`
    3. `useKonvaLocalYjsRealtimeConnection.ts`
    4. `konvaLocalYjsSyncContract.ts`
    5. a thin `useKonvaLocalYjsSync.ts` orchestrator
  - `webSocketBoardRealtimeRoom.ts` has now been split into:
    1. thin `webSocketBoardRealtimeRoom.ts` entry exports
    2. `webSocketBoardRealtimeSharedRoom.ts` coordinator
    3. `webSocketBoardRealtimeAwarenessStore.ts`
    4. `webSocketBoardRealtimeDocumentBridge.ts`
  - `useKonvaCanvasBoardCollaborationBridge.ts` has started slimming into pure derived helpers:
    1. `konvaCanvasBoardCollaborationDerived.ts` now owns page summaries, remote edge session projection and read-only/tool-mode derivation
  - transient board overlay prop assembly has been separated:
    1. `konvaCanvasSpikeTransientUiProps.ts` now owns transient UI prop composition
    2. `konvaCanvasSpikeViewProps.ts` is now a thin shell/transient export surface
  - `useBoardCollaborationPresence.ts` has now been reduced to a thin presence/session orchestrator:
    1. `useBoardCollaborationLocalPresence.ts` now owns local cursor/hover/editing refs and local presence snapshot publishing
  - `KonvaBoardSaveAudit.tsx` has now been reduced to a thin save/status surface:
    1. `useKonvaBoardPersistenceLifecycle.ts` owns autosave/save/load status transitions
    2. `useKonvaBoardRestoreLifecycle.ts` owns restore/autoload/snapshot-restore state
    3. `useKonvaBoardDocumentPreparation.ts` owns guarded document prep and thumbnail capture
  - Board access-entry surfaces for real collaboration testing have also been thinned:
    1. `BoardManagementMembers.tsx` now delegates member list/search/mutation state to `useBoardManagementMembers.ts`
    2. `localBoardClient.ts` is now a thin export surface over persistence / members / share / snapshots sub-clients
    3. `WorkspaceBoardGallery.tsx` is now split into render/runtime/data/derived layers so board-entry testing is no longer blocked by a single 500+ line page surface
    4. backend board routing is now split into `boards.py` core CRUD/snapshots, `boards_collaboration.py` members/share/validate, and `boards_realtime.py` sessions/websocket flow
    5. board storage backends are now also flattened into thin facades plus focused modules:
       - `local_board_store.py` -> `local_board_store_boards.py` / `records.py` / `members.py` / `shares.py` / `support.py`
       - `postgres_board_store.py` -> `postgres_board_store_boards.py` / `mutations.py` / `members.py` / `shares.py` / `support.py`
    6. local app collaboration route storage is now also flattened:
       - `localBoardCollaborationStore.ts` -> `access.ts` / `presence.ts` / `sessionStore.ts` / `support.ts`
    7. local app board member/share entry is now flattened too:
       - `localBoardMembersStore.ts` -> member CRUD/search facade
       - `localBoardShareStore.ts` / `localBoardWorkspacePeopleStore.ts` / `localBoardRecordAccess.ts` / `localBoardMembersSupport.ts`
    8. backend collaboration session persistence is now flattened too:
       - shared normalization lives in `board_collaboration_store_support.py`
       - `local_board_collaboration_store.py` stays as the file-session facade
       - `postgres_board_collaboration_store.py` stays as the SQL-session facade
    9. realtime hub follow-up: `board_realtime_hub.py` is now a thin room façade over `board_realtime_room_support.py`, which owns broadcast plus awareness pruning helpers.
  - 2026-05-17 storage regression checkpoint:
    1. `test_board_permission_contracts.py` passed
    2. `test_board_persistence_contracts.py` passed
    3. `test_board_collaboration_contracts.py` passed
    4. `test_board_realtime_websocket.py` passed
  - Remaining next seam inside websocket transport:
    - backend next: move on to `team_subscription_lifecycle.py` and the remaining admin/billing client type files
    - frontend next: if/when it grows again, split `webSocketBoardRealtimeSharedRoom.ts` into socket lifecycle transport and room coordinator before adding more behavior
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
- API-level Team/Group collaboration session smoke via `services/api/scripts/s4_collaboration_presence_smoke.py`
- One-command readiness preflight via `services/api/scripts/s4_collaboration_readiness.py`
- Two-user cursor visibility smoke
- Two-user sensitive-edit occupancy smoke
- Two-user optimistic draw/move smoke
