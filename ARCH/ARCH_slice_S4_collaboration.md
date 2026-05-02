# ARCH Slice S4: Collaboration

**Updated**: 2026-05-02
**Status**: Deferred to P0.5.

## Scope

Realtime multi-user Board editing after S1/S2 boundaries are stable.

## Boundary Diagram

```text
CRDT / realtime doc
  -> lightweight shapes, layout, node params, edges, Asset refs

Presence
  -> cursors, selection, current tool, viewing state

Server authority
  -> Auth, permissions, AI runs, credits, Asset writes, Board snapshots

Local UI only
  -> hover state, selection panels, LOD mode, transient tool state
```

## Rules

- CRDT does not store image binaries, Base64, provider payloads or complete logs.
- AI Run and credit state are not decided by clients.
- Board History remains guarded and restorable.
- Collaboration waits until real Auth, Board members and storage boundaries exist.
