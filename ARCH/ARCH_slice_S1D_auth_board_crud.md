# ARCH Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-02
**Mode**: Architecture slice.
**Status**: After S1C.

## Goal

Move Board list/load/save/history/assets from local/dev identity to real permission-checked FastAPI APIs.

## Permission Model

Workspace roles:

```text
owner
admin
member
guest
```

Board roles:

```text
owner
admin
editor
viewer
temporary_viewer
```

Rules:

- Owner/admin can update Board metadata, visibility, members and delete.
- Editor can save Board document and create snapshots, but cannot change ownership/security metadata.
- Viewer can load Board and History summaries if allowed, but cannot save.
- Temporary viewer requires `expires_at`.
- Private Board is visible only to owner/admin/member grants.
- Public/shared Board must still have server-side share link validation.

## API Contracts

```text
GET    /api/v1/boards?workspaceId=&cursor=&limit=&sort=&query=
POST   /api/v1/boards
GET    /api/v1/boards/{boardId}
PATCH  /api/v1/boards/{boardId}
DELETE /api/v1/boards/{boardId}
POST   /api/v1/boards/{boardId}/copy
POST   /api/v1/boards/{boardId}/open

GET    /api/v1/boards/{boardId}/snapshots?cursor=&limit=&reason=
POST   /api/v1/boards/{boardId}/snapshots
GET    /api/v1/boards/{boardId}/snapshots/{snapshotId}
POST   /api/v1/boards/{boardId}/restore

GET    /api/v1/boards/{boardId}/members
POST   /api/v1/boards/{boardId}/members
PATCH  /api/v1/boards/{boardId}/members/{userId}
DELETE /api/v1/boards/{boardId}/members/{userId}
```

## Query Rules

- List endpoints return summaries only.
- Full Board document is returned only by load endpoint after permission check.
- All list endpoints use cursor pagination.
- Board list sorting supports saved, opened, pinned, title.
- Star/pin/recent-open come from `board_user_preferences`.
- History list supports reason filter: autosave, manual, keyboard, restore.

## Data Guard

- Run Board document guard on save and snapshot.
- Reject `data:`, `blob:` and Base64 image payloads.
- Enforce document byte-size and shape/asset count limits.
- Verify assets referenced by Board belong to the same workspace or are shared through an allowed reference.

## Acceptance

- User A cannot list/load/save/delete User B's private Board.
- Owner can add editor/viewer.
- Editor can save but cannot change card color, thumbnail, visibility or members.
- Viewer cannot save.
- Board copy preserves allowed metadata and creates new ownership correctly.
- Snapshot retention rules work for autosave and manual saves.
- Pagination remains stable while Boards are added.
