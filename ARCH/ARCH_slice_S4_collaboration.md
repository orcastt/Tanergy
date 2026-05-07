# ARCH Slice S4: Collaboration

**Updated**: 2026-05-05
**Status**: Deferred to P0.5 and frozen for the current P0 alpha stabilization pass.

## Scope

Realtime multi-user Board editing after S1/S2 boundaries are stable.

## Stabilization Rule

Keep this slice fully deferred during the current P0 alpha stabilization pass. Readiness notes are allowed; release-scope implementation is not.

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

## First Proof Sequence

1. Map Konva v2 `CanvasDocument` + `pages[]` into a Yjs document without binary payloads.
2. Add awareness for cursor, selection, active page and current tool.
3. Enforce editor/viewer writes through server-authoritative membership before production use.
4. Keep Board snapshots as guarded server documents, not raw CRDT dumps.
