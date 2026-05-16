# Project State Slice S4: Collaboration

**Updated**: 2026-05-16
**Status**: In progress first slice. Collaboration is still outside the current release promise, but the invite-entry product path and first presence polish have now started in the real app shell.

## Current Truth

- The local/provider-shaped Yjs bridge already exists with reconnect/resync smoke and a permission-aware websocket room foundation.
- Workspace invite links, workspace member roles and board member roles already exist in the backend/frontend stack; collaboration does not need a second membership model.
- Invite creation in the product UI now targets a real frontend route, `/invite/[token]`, instead of copying the raw API accept endpoint. The shared parser now accepts both `/invite/[token]` and legacy `/api/v1/workspaces/invitations/{token}/accept` links.
- Sign-in/sign-up now preserve invite continuation through sanitized same-app redirect paths, so invite acceptance can continue after auth instead of dropping the user back on `/workspaces`.
- Team/Group invite links can now optionally carry `boardId`/`boardTitle` metadata, so accept can continue straight into `/boards/[boardId]?workspace=...` instead of stopping at the workspace shell.
- Team/Group dashboard invite creation now exposes that board target directly, and dashboard board cards now open the real board route instead of dead-ending in a static button.
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
- Remote cursor rendering now applies a lightweight display-side interpolation, so collaborator cursor motion feels less jittery without increasing awareness payload frequency.
- Edge/port collaboration cues are now live in the same presence channel: local edge selection publishes `selectedEdgeId`, node-port drag publishes a lightweight `connectionPreview`, and remote sessions render those cues as colored connection highlights/previews on the canvas without mutating board document state.
- The collaboration client surface has been cut into smaller pieces again: session/presence merge helpers now live in `boardCollaborationPresenceState.ts`, realtime awareness connection/publish lifecycle now lives in `useBoardRealtimeAwareness.ts`, and `useBoardCollaborationPresence.ts` is now focused on local optimistic presence state plus server session claim/release.
- 2026-05-16 follow-up cleanup: claim/release/session heartbeat/debounced sync now live in `useBoardCollaborationSessionSync.ts`, which brings `useBoardCollaborationPresence.ts` down again. The next optional split, if we keep tightening it, is to peel local optimistic patch/apply helpers out of the remaining presence hook body.
- Workspace invite history in the dashboard is now grouped into explicit `pending / accepted / revoked` states instead of a single undifferentiated history list.
- Team workspace ownership transfer now has a first safe product/backend path for existing members. Group workspace owner transfer is still intentionally blocked until billing ownership rules are designed.
- Current account-deletion hard-delete is live, but paid Team/Group membership cleanup still needs another blocker pass before collaboration scale-up.
- `services/api/scripts/s4_workspace_invite_smoke.py` now covers the API-level Team/Group invite acceptance matrix: owner creates board, owner creates board-target invite, invitee accepts, invitee reopens the same board collaboration route inside the invited workspace.

## Reuse First

- `tangent_workspace_invitations`
- `tangent_workspace_members`
- `tangent_board_members`
- existing Team/Group invite create/accept/revoke routes
- existing board permission resolver and owner-only board delete/copy rules
- existing websocket room plus Yjs awareness/document bridge

## Next Implementation Order

1. Execute the new Team/Group dual-user smoke against real signed-in accounts, not only local/header-mode automation.
2. Keep expanding live collaborator presence validation from cursor/name/color into active page, tool and invite-entry reopening flows.
3. Validate the current page-scoped Yjs claim with real two-user same-board multi-page smoke before widening the marketing language around collaboration scope.
4. Broaden optimistic merge rules only where page-scoped metadata can prove they are safe; keep same-page and full-board conflicts conservative.
5. Add explicit two-user occupancy acceptance around focused text/node-parameter editing, then refine cursor easing/lerp behavior from "less jittery" toward a more Miro-like soft stop.
6. After that, move from presence-first collaboration into the next Yjs/editor slice: shared selection semantics, stronger remote intent cues and multi-user object conflict policy.

## Do Not Drift

- Do not let Yjs awareness become the permission source.
- Do not treat all canvas edits as hard-locked; use occupancy only for sensitive focused editing.
- Do not create a second invite schema when the current Team/Group invite tables already exist.
