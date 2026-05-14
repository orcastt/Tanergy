# ARCH Slice S4: Collaboration

**Updated**: 2026-05-14
**Status**: Deferred to P0.5 and frozen for the current P0 alpha stabilization pass; local/provider-shaped bridge and reconnect/resync smoke now exist, but production multiplayer is still out of scope.

## Scope

Realtime multi-user Board editing after S1/S2 boundaries are stable.

## Stabilization Rule

Keep this slice fully deferred during the current P0 alpha stabilization pass. Readiness notes are allowed; release-scope implementation is not.

## Current Readiness Notes

- Collaboration transport is now two-tier. The board-realtime hooks prefer a FastAPI websocket room when a remote persistence API plus `boardId` are available, and otherwise fall back to the existing board-scoped `BroadcastChannel` rooms for local/dev use.
- Both the document and awareness transport adapters share the same room-state shape: `connecting | synced | disconnected | error | unsupported`, plus `initialSyncComplete`, `lastActivityAt`, `lastSyncedAt` and surfaced error text.
- The current websocket room is intentionally minimal and provider-shaped rather than full Yjs-server-native. It gates access through existing board collaboration permissions, persists a board-scoped Yjs update chain in local-dev/Postgres realtime storage, replays that chain to newcomers as `sync-state`, uses an explicit `seedRoom` handshake so clients seed only genuinely empty rooms, requests a client `sync-state-publish` compaction when the incremental chain grows past a threshold, acknowledges accepted full-state publishes back to connected clients as `sync-state-accepted`, and fans out awareness `batch/state/remove` events.
- The browser collaboration hook now uses the native structured Yjs board record (`pages[]`, `activePageId`, shared canvas settings, changed-page metadata) as its runtime apply contract. Legacy full-document snapshot fallback/materialization is removed from this path, and the synchronization baseline now keeps only structured page data plus signature metadata instead of a duplicated serialized board envelope.
- Presence currently includes cursor, active page, selected ids, hovered shape id, editing shape ids, tool and derived viewing state. Temporary occupancy/soft-lock UI is derived from awareness owner identity plus awareness TTL expiry rather than a persisted server lock table.
- Current soft-lock behavior is advisory: the canvas renders remote selected/editing/hovered bounds and blocks local text/crop entry when another active session is already editing the same shape, but there is no hard distributed lease/claim service yet.
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

## First Proof Sequence

1. Map Konva v2 `CanvasDocument` + `pages[]` into a Yjs document without binary payloads.
2. Add awareness for cursor, selection, active page and current tool.
3. Enforce editor/viewer writes through server-authoritative membership before production use.
4. Keep Board snapshots as guarded server documents, not raw CRDT dumps.
