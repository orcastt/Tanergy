# Project State Slice S4: Collaboration

**Updated**: 2026-05-17
**Status**: In progress first slice. Collaboration is still outside the current release promise, but the invite-entry product path and first presence polish have now started in the real app shell. The local/backend contract layer is green again after the 2026-05-16 stale-regression reset, while real signed-in two-user staging smoke still remains the next acceptance gate.

## Current Truth

- Collaboration sequencing is now explicit: deeper Yjs / conflict-policy work stays behind the confirmed Team / Group / Billing / Invite foundation, so membership and payer rules do not keep shifting underneath presence work.
- The local/provider-shaped Yjs bridge already exists with reconnect/resync smoke and a permission-aware websocket room foundation.
- Workspace invite links, workspace member roles and board member roles already exist in the backend/frontend stack; collaboration does not need a second membership model.
- Invite creation in the product UI now targets a real frontend route, `/invite/[token]`, instead of copying the raw API accept endpoint. The shared parser now accepts both `/invite/[token]` and legacy `/api/v1/workspaces/invitations/{token}/accept` links.
- Sign-in/sign-up now preserve invite continuation through sanitized same-app redirect paths, so invite acceptance can continue after auth instead of dropping the user back on `/workspaces`.
- Team/Group invite links can now optionally carry `boardId`/`boardTitle` metadata, so accept can continue straight into `/boards/[boardId]?workspace=...` instead of stopping at the workspace shell.
- The board route now treats that `workspace` query as a real session-selection hint when loading signed-in access, so invite acceptance no longer depends on the old active-workspace session cache updating before the invited board is reopened.
- Team/Group dashboard invite creation now exposes that board target directly, and dashboard board cards now open the real board route instead of dead-ending in a static button.
- Invite acceptance semantics now follow the confirmed S3 rule: Team invite accept checks Team seat capacity, Group invite accept checks Group member capacity, and neither path rejects the user purely for being on the free personal tier.
- That invite policy now also has its own focused contract guard in `test_workspace_invitation_policy_contracts.py`, so the confirmed baseline around free-user joins does not depend only on broader mixed invitation tests.
- Canonical visible collaboration roles should now be treated as `owner/admin/editor/viewer` for workspaces, with board roles `owner/admin/editor/viewer/temporary_viewer`.
- That canonical role language is now enforced at key boundaries too: auth session memberships, workspace invite reads/writes, local board-member metadata and local collaboration presence all normalize legacy `member/guest` into `editor/viewer` before surfacing to product UI.
- Remote cursor/occupancy/header presence colors now derive from `clientInstanceId`, so separate live sessions from the same user are visually distinct.
- Presence UI now also surfaces current tool and cross-page context: cursor labels show current activity, and the board header shows compact collaborator chips for current page / current tool state.
- The board header presence shell now includes a compact collaborator roster popover, so active users, session-scoped colors, roles and current activity can be inspected from the top bar without relying only on cursor labels.
- Focused-edit occupancy now covers text edit, node text edit, image crop, node parameter dropdowns and the chat model menu. The browser reuses shared awareness `editingShapeIds` for these states instead of introducing a second lock service.
- When a second user tries to enter one of those focused modes, the board now shows an in-canvas denial toast so the feedback is visible even when the selection toolbar is not on screen.
- Local unsynced edits no longer block every remote apply. If the incoming Yjs record changed different pages from the current unsynced local publish, the browser now applies that remote record immediately and lets the existing page-merge path reconcile both sides. Same-page overlap and `full-board` publishes still stay conservative.
- Remote presence polish now includes per-object selection tint and a stronger remote marquee treatment, so another collaborator's selection is visible both as grouped bounds and as subtle object-level highlights.
- Drag-select marquee presence is now live end-to-end: the local select-box bounds are sanitized into awareness/session presence and other collaborators see that in-progress marquee on the canvas before selection is committed.
- Remote transform hints are now live too: move, resize and rotate publish lightweight awareness preview bounds, so collaborators can see when a selected set is actively being manipulated instead of only seeing the final selection result.
- Remote cursor rendering now applies a lightweight world-space RAF easing layer, so collaborator cursor motion feels less jittery and lands with a softer stop without making local camera pan/zoom feel laggy.
- Edge/port collaboration cues are now live in the same presence channel: local edge selection publishes `selectedEdgeId`, node-port drag publishes a lightweight `connectionPreview`, and remote sessions render those cues as colored connection highlights/previews on the canvas without mutating board document state.
- The collaboration client surface has been cut into smaller pieces again: session/presence merge helpers now live in `boardCollaborationPresenceState.ts`, realtime awareness connection/publish lifecycle now lives in `useBoardRealtimeAwareness.ts`, and `useBoardCollaborationPresence.ts` is now focused on local optimistic presence state plus server session claim/release.
- 2026-05-16 follow-up cleanup: claim/release/session heartbeat/debounced sync now live in `useBoardCollaborationSessionSync.ts`, which brings `useBoardCollaborationPresence.ts` down again. The next optional split, if we keep tightening it, is to peel local optimistic patch/apply helpers out of the remaining presence hook body.
- 2026-05-17 local-app follow-up: the local board collaboration API store is now split again into thin access/presence/session-support modules. `localBoardCollaborationStore.ts` is a 121-line facade over `localBoardCollaborationAccess.ts`, `localBoardCollaborationPresence.ts`, `localBoardCollaborationSessionStore.ts` and `localBoardCollaborationSupport.ts`.
- 2026-05-17 board-access follow-up: `localBoardMembersStore.ts` is now also back under the line-budget rule. Share-link flows, workspace-people persistence and shared board-record access live in `localBoardShareStore.ts`, `localBoardWorkspacePeopleStore.ts`, `localBoardRecordAccess.ts` and `localBoardMembersSupport.ts`, while the main file stays focused on member CRUD/search/invite wiring.
- 2026-05-17 storage hardening pass: both board storage backends now follow the same thin-facade pattern. `local_board_store.py` delegates into boards/records/members/shares/support modules, and `postgres_board_store.py` now delegates into boards/mutations/members/shares/support modules. The split preserved the old `tangent_api.storage.postgres_board_store.connect_to_postgres` monkeypatch seam so existing board persistence/collaboration/realtime contract tests still pass.
- 2026-05-17 collaboration storage hardening pass: both collaboration session backends are now back under the line-budget rule too. Shared presence/session normalization now lives in `board_collaboration_store_support.py`, while `local_board_collaboration_store.py` and `postgres_board_collaboration_store.py` stay focused on local-file vs Postgres session lifecycle differences and preserve their existing monkeypatch seams.
- 2026-05-17 realtime hub slimming pass: `board_realtime_hub.py` is now a 288-line façade, with room connection/broadcast and awareness pruning helpers moved into `board_realtime_room_support.py`. The websocket regression suite still passes after the split.
- Workspace invite history in the dashboard is now grouped into explicit `pending / accepted / revoked` states instead of a single undifferentiated history list.
- The Team/Group workspace directory shell is now also back under the line-budget rule: `WorkspaceDirectoryView.tsx` is a thin state/filter shell again, and its card/section/featured-summary presentation moved into `WorkspaceDirectoryViewParts.tsx`.
- Team workspace ownership transfer now has a first safe product/backend path for existing members. Group workspace owner transfer is still intentionally blocked until billing ownership rules are designed.
- Current account-deletion hard-delete is live, but paid Team/Group membership cleanup still needs another blocker pass before collaboration scale-up.
- `services/api/scripts/s4_workspace_invite_smoke.py` now covers the API-level Team/Group invite acceptance matrix: owner creates board, owner creates board-target invite, invitee accepts, invitee reopens the same board collaboration route inside the invited workspace.
- 2026-05-16 regression reset: collaboration/realtime tests now explicitly lock the current rule that a `guest` does not gain board or websocket access merely from `visibility=workspace`; readable guest access still requires explicit board membership such as `viewer`.

## Reuse First

- `tangent_workspace_invitations`
- `tangent_workspace_members`
- `tangent_board_members`
- existing Team/Group invite create/accept/revoke routes
- existing board permission resolver and owner-only board delete/copy rules
- existing websocket room plus Yjs awareness/document bridge

## Next Implementation Order

1. Execute the new Team/Group dual-user smoke against real signed-in accounts, not only local/header-mode automation.
2. Verify the invite -> accept -> joined workspace -> same board realtime reopen chain in the actual browser with two users, now that board-route session selection is pinned to the invite target workspace instead of the previous active workspace.
3. Keep expanding live collaborator presence validation from cursor/name/color into active page, tool and invite-entry reopening flows.
4. Validate the current page-scoped Yjs claim with real two-user same-board multi-page smoke before widening the marketing language around collaboration scope.
5. Broaden optimistic merge rules only where page-scoped metadata can prove they are safe; keep same-page and full-board conflicts conservative.
6. Add explicit two-user occupancy acceptance around focused text/node-parameter editing, then refine cursor easing/lerp behavior from "less jittery" toward a more Miro-like soft stop.
7. After that, move from presence-first collaboration into the next Yjs/editor slice: shared selection semantics, stronger remote intent cues and multi-user object conflict policy.
8. In parallel with the next collaboration slice, keep pulling S3/S4 support files under the `<300` rule, with the next collaboration hotspot now shifting to `team_subscription_lifecycle.py` and the remaining oversized admin/billing/client type files.

## Do Not Drift

- Do not let Yjs awareness become the permission source.
- Do not treat all canvas edits as hard-locked; use occupancy only for sensitive focused editing.
- Do not create a second invite schema when the current Team/Group invite tables already exist.
