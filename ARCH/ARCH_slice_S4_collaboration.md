# ARCH Slice S4: Collaboration

**Updated**: 2026-05-16
**Status**: In progress first slice after the current S1/S2/S3 acceptance gates. Production multiplayer remains outside the current release promise, but the reusable invite/role contracts are now being wired into the real product path.

## Scope

Realtime multi-user Board editing after S1/S2 boundaries are stable.

## Stabilization Rule

Keep this slice outside the current release promise until the signed-in browser, Google/email and live AI gates are closed. Readiness notes, schema alignment and a bounded implementation plan are allowed because collaboration reuses S1D/S3 member-role and invite contracts.

## 2026-05-16 Foundation Gate

The collaboration slice now has an explicit dependency on the confirmed Team / Group / Billing / Invite baseline:

- invite acceptance is capacity-based, not personal-plan-tier-based
- free users may join Team and Group workspaces through valid invites when the target workspace still has capacity
- Team collaboration always charges the Team wallet
- Group collaboration always charges the acting user's personal wallet
- Team owner transfer can move forward first, while Group owner transfer remains blocked
- deeper Yjs conflict policy and presence polish should be layered on top of these fixed membership/billing rules, not alongside another round of policy churn

## Current Readiness Notes

- Existing reusable member/invite contracts already exist in the product path:
  - workspace invite roles: `admin/editor/viewer`
  - workspace invite managers: `owner/admin`
  - stored active workspace roles currently accept `owner/admin/editor/viewer/member/guest`
  - stored board-member roles currently accept `owner/admin/editor/viewer/temporary_viewer`
- Frontend invite generation now needs to point at a product route, not the raw API `POST /accept` endpoint. The active product path is `/invite/[token]`, and the token parser must accept both that route and the legacy API accept URL so old copied links still work.
- Invite-to-board reopen now has an additional frontend session-selection boundary: when `/boards/[boardId]` carries `?workspace=...`, the client session loader must request authenticated session context for that target workspace before board load/realtime setup, instead of assuming the previously active workspace cache has already switched.
- Clerk sign-in/sign-up continuation for invites is now a frontend boundary too: `redirect_url`/`redirectUrl`/`next` must be sanitized to same-app relative paths before being passed into the auth components.
- The next collaboration implementation should reuse those contracts instead of inventing a second invite or role table. Product-facing language should standardize on `owner/admin/editor/viewer`, while `member/guest` stay compatibility-only until a later cleanup migration removes them.
- Invite acceptance semantics now align with S3 commercial rules too: Team accepts check Team seat capacity, Group accepts check Group member capacity, and neither path should reject a user simply for being on `free_canvas`.
- Canonical role normalization is now applied at the session/invite/local-collaboration boundary: authenticated sessions, workspace invites and local-dev board presence/member metadata should surface `owner/admin/editor/viewer`, while legacy `member/guest` are accepted only as compatibility aliases that map to `editor/viewer`.
- Team workspace owner transfer is now part of the collaboration-adjacent governance boundary: current safe support is Team-only transfer to an existing member, while Group workspace ownership transfer stays blocked until billing-owner semantics are defined.
- Collaboration transport is now two-tier. The board-realtime hooks prefer a FastAPI websocket room when a remote persistence API plus `boardId` are available, and otherwise fall back to the existing board-scoped `BroadcastChannel` rooms for local/dev use.
- Both the document and awareness transport adapters share the same room-state shape: `connecting | synced | disconnected | error | unsupported`, plus `initialSyncComplete`, `lastActivityAt`, `lastSyncedAt` and surfaced error text.
- The current websocket room is intentionally minimal and provider-shaped rather than full Yjs-server-native. It gates access through existing board collaboration permissions, persists a board-scoped Yjs update chain in local-dev/Postgres realtime storage, replays that chain to newcomers as `sync-state`, uses an explicit `seedRoom` handshake so clients seed only genuinely empty rooms, requests a client `sync-state-publish` compaction when the incremental chain grows past a threshold, acknowledges accepted full-state publishes back to connected clients as `sync-state-accepted`, and fans out awareness `batch/state/remove` events.
- The browser collaboration hook now uses the native structured Yjs board record (`pages[]`, `activePageId`, shared canvas settings, changed-page metadata) as its runtime apply contract. Legacy full-document snapshot fallback/materialization is removed from this path, and the synchronization baseline now keeps only structured page data plus signature metadata instead of a duplicated serialized board envelope.
- The local Yjs incoming-record gate is now page-aware instead of globally conservative. When both sides have structured `changedPageIds`, the browser may immediately restore a remote update while unsynced local edits still exist if the two change sets are page-disjoint and neither side is publishing a `full-board` snapshot. Same-page overlap and full-board snapshots still queue pending remote state until the local publish settles.
- Presence currently includes cursor, active page, selected ids, hovered shape id, editing shape ids, tool and derived viewing state. The first visible frontend pass now surfaces that data through cursor labels, compact board-header activity chips, and a header roster popover that lists active collaborators with session-aware color identity plus role/activity metadata. Temporary occupancy/soft-lock UI is derived from awareness owner identity plus awareness TTL expiry rather than a persisted server lock table.
- Remote cursor motion on the canvas now uses a lightweight client-side easing layer in world space, so the display can soften collaborator movement without letting local camera pan/zoom inherit extra lag or adding extra payload churn to awareness.
- Presence now also carries an optional lightweight `selectionBox` world-bounds payload for active drag-select gestures. This is awareness-only geometry, not document state, and is sanitized/rounded on both frontend and backend before transport or persistence.
- Presence also carries optional `transformKind` + `transformBox` metadata for in-progress move/resize/rotate gestures. This remains awareness-only preview geometry, so remote transform hints can be rendered without storing transient manipulation state in the board document.
- Presence now also carries optional `selectedEdgeId` and `connectionPreview` metadata for node-edge collaboration. `connectionPreview` contains only data type, source/source-batch endpoints, pointer and optional snapped target endpoint; it never stores resolved port geometry in persisted collaboration state.
- First-pass visual presence identity should derive accent color from `clientInstanceId`, not only `userId`, so two concurrent sessions from the same user stay visually distinguishable in cursors, occupancy outlines and presence pills.
- Current soft-lock behavior is advisory: the canvas renders remote selected/editing/hovered bounds and blocks local text/crop entry when another active session is already editing the same shape, but there is no hard distributed lease/claim service yet.
- Focused-edit occupancy is now shape-scoped and awareness-driven across: plain text edit, node text edit, image crop, node parameter dropdowns and the chat model menu. The same `editingShapeIds` presence channel is reused for these focused controls rather than introducing a separate persistent lock table.
- Occupancy denial feedback for focused controls now renders inside the canvas shell as a lightweight toast, so second entrants still get visible feedback even when the selection toolbar is hidden.
- The canvas overlay now renders three distinct remote collaboration layers from awareness: selection-box marquee while another user is drag-selecting, per-object tint for remote selection/edit occupancy, and aggregate occupancy bounds with labels. This keeps the rendering work local to the overlay instead of patching each shape type with remote-collaboration state.
- Remote transform hints now reuse that same overlay layer: when another user is moving/resizing/rotating a selected set, the overlay renders a transform-specific bounds treatment and suppresses the redundant plain selection box for that same session.
- Remote node-edge intent now renders in the Konva edge layer instead of the DOM overlay: remote selected edges get an accent highlight, and remote port-drag sessions render an accent connection preview plus snapped target cue when applicable. This keeps edge geometry in the same canvas render pass as local runtime edges.
- The websocket room is still a readiness bridge, not the final production provider: while its update chain is now backend-persistent and can be collapsed back to a fresh full-state snapshot through client-assisted compaction, it is still single-process in fan-out behavior, not yet merging updates server-side, and not yet multi-instance safe.
- Realtime document writes must be enforced server-side, not inferred from frontend mode. The websocket route now allows read-only collaborators to join for replay/presence but rejects `yjs-update` and `sync-state-publish` once board edit access is absent.
- Client-assisted compaction is guarded by a room-local `documentVersion` handshake. A full-state compaction publish is only accepted when it matches the room's current version, which prevents a stale compactor from overwriting newer unseen incremental updates.
- A successful `sync-state-publish` now also resets the room's incremental chain/version to the accepted compacted baseline and tells connected clients the new `documentVersion`, so future compaction attempts do not continue from stale pre-compaction counters.
- When a client tries to publish a stale full-state compaction snapshot, the websocket route now returns an explicit current `sync-state` resync payload instead of silently dropping the publish. This lets stale clients re-apply the authoritative update chain and, if compaction is still requested, immediately retry from the new version.
- The browser websocket document room now also keeps a bounded outbound Yjs update queue. Local edits made before initial room sync settles or while the websocket is temporarily disconnected are queued instead of dropped, the shared room state exposes `queued` / `flushing` outbound status with queue counts/bytes, and pending updates flush once reconnect + sync settlement completes.
- Websocket awareness is lease-shaped rather than permanent session state: `expiresAt` is treated as active TTL both in the server room and in the browser mirror, and expired awareness records must be pruned instead of lingering until disconnect.
- The websocket browser room now treats 44xx close codes as non-retryable authorization/configuration failures rather than transient disconnects, so access errors surface as room errors instead of entering a reconnect loop.
- Realtime memory safety is now part of the room contract. Server rooms normalize persisted update chains before loading them, reject appends that would exceed the update-count or total-byte cap, request compaction instead of retaining oversize chains, cap awareness state count/size/TTL, and remove rooms once the last connection leaves.
- `services/api/scripts/s4_realtime_resync_smoke.py` is now the reusable websocket/provider acceptance harness for this bridge layer. It creates isolated reconnect/stale boards, verifies replay after reconnect, drives a compaction threshold crossing, advances the room from a second tab, and confirms a stale `sync-state-publish` gets an authoritative resync payload back instead of overwriting newer state. The same script now passes both against a clean `local-dev` room and against the current real-DB `8100` chain, which means the remaining concern is latency under persisted update churn rather than reconnect/resync correctness.
- Browser collaboration caches are bounded: websocket/local awareness mirrors keep only the newest active states, websocket rooms detach Yjs listeners on final release, pending remote snapshots retain metadata only, local and websocket Yjs transports reject oversize outbound update payloads before array/JSON expansion, presence is sanitized before API/BroadcastChannel/websocket send, and the old snapshot materialization fallback is no longer used for the structured Konva/Yjs runtime path.
- The local collaboration permission fallback now fails closed to view-only when member metadata is unavailable; owners still resolve as owner before member lookup. This keeps local/dev presence useful without silently granting edit authority when membership data is missing.
- The frontend collaboration hook surface has now been split more cleanly too: `boardCollaborationPresenceState.ts` owns session/presence merge helpers, `useBoardRealtimeAwareness.ts` owns awareness room connection plus publish throttling, and `useBoardCollaborationPresence.ts` owns optimistic local presence plus claim/release flow.

## Boundary Diagram

```text
CRDT / realtime doc
  -> lightweight shapes, layout, node params, edges, Asset refs

Presence
  -> cursors, selection, hovered/editing occupancy, current tool, viewing state

Server authority
  -> Auth, permissions, AI runs, credits, Asset writes, Board snapshots

Local UI only
  -> selection panels, LOD mode, transient tool state beyond the shared presence contract
```

## Rules

- CRDT does not store image binaries, Base64, provider payloads or complete logs.
- AI Run and credit state are not decided by clients.
- Board History remains guarded and restorable.
- Collaboration waits until real Auth, Board members and storage boundaries exist.
- Invite lifecycle, workspace membership and board permission continue to be resolved by the server; Yjs awareness cannot mint access by itself.
- Occupancy should be awareness-driven first. Do not introduce a heavy persistent lock table for ordinary drawing/move/selection operations.
- The phrase "one user is doing this item, others cannot do it" should apply to focused text-like and node-parameter edit modes, not to all canvas movement. Ordinary shape moves and free drawing should stay optimistic and mergeable.

## First Proof Sequence

1. Reuse the existing Team/Group invite-link and workspace-member contracts so collaboration starts from real membership, not anonymous room presence.
2. Expose a real `/invite/[token]` landing page that signs the user in/up and then accepts into the correct Team/Group workspace shell.
3. Map Konva v2 `CanvasDocument` + `pages[]` into a Yjs document without binary payloads.
4. Add awareness for cursor, selection, active page, current tool and focused editing ids.
5. Enforce editor/viewer writes through server-authoritative membership before production use.
6. Add occupancy for sensitive text/node-param edit modes; second entrants should be blocked or downgraded to view while the first editor is active. This first pass now covers text edit, crop, node dropdowns and chat model selection through shared awareness.
7. Keep Board snapshots as guarded server documents, not raw CRDT dumps.

## Canonical Permission Matrix

Workspace roles:

```text
owner  -> billing, seats, invites, member-role changes, workspace delete, full board access
admin  -> invites, member-role changes except owner transfer, normal board management, no ownership transfer
editor -> board edit/run access, no workspace member management
viewer -> read-only workspace/board access
```

Board roles:

```text
owner             -> copy/delete plus all board actions
admin             -> invite/share/rename/member management, no forced owner-only copy/delete
editor            -> read/write board content
viewer            -> read-only board access
temporary_viewer  -> public/share-link style read-only access
```
