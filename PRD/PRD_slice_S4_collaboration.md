# PRD Slice S4: Collaboration

**Updated**: 2026-05-05
**Status**: Deferred to P0.5.

## Goal

Enable multiple users to edit the same Board without breaking Asset, Board, Auth or AiRun authority boundaries.

## Product Requirements

| Area | Requirement |
| --- | --- |
| Presence | Users can see collaborators, cursors and basic activity. |
| Roles | Board roles support owner/admin/editor/viewer/temporary viewer. |
| Realtime edit | Shape movement, drawing and lightweight Board document updates sync in real time. |
| Soft locks | Editing sensitive node params can show soft occupancy. |
| Snapshots | Board History remains recoverable under collaboration. |
| Authority | AI runs, credit charges, Asset writes and permissions remain server-authoritative. |

## Non-Goals For P0

- No collaboration before Auth, Board CRUD, Asset storage and AiRun boundaries are stable.
- No CRDT storage of images, provider payloads or long logs.

## Readiness Note

S1X keeps Yjs viability open, but production collaboration remains P0.5. The first proof should use Konva v2 `CanvasDocument` plus `pages[]`, store only lightweight shapes/runtime edges/Asset refs in the CRDT, and leave AI runs, credits, Asset writes and permission checks server-authoritative.
