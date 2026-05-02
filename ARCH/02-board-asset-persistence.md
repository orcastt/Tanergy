# Board / Asset Persistence Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.2, 4.7, 5.3-5.5, 8.2-8.3, 11.5.1

## Persistence Diagram

```text
Workspace Board UI
  -> board summary list only
  -> title/description/card color/thumbnail/star/pin/visibility summary metadata

/boards/:boardId Canvas
  -> serialize guarded Board document
  -> migrate runtime image assets to Asset URLs
  -> save Board summary + document
  -> create History entries for autosave/manual/keyboard/refresh

Local development
  -> Next route handlers
  -> .tangent-boards/
  -> .tangent-assets/

Staging/prod shape
  -> FastAPI /api/v1
  -> Postgres metadata and Board documents
  -> R2/S3-compatible object storage for files
```

## Current Boundary

- Board list returns summary only, never full document.
- Board save returns summary only.
- Board load returns document and must be workspace/user scoped.
- Board save runs guard before persistence.
- Board History documents run the same guard.
- History list returns summary only; history load returns full document.
- Board documents may store lightweight `canvasSettings`.
- Board documents may not store `data:`, `blob:`, Base64 image payloads, provider raw responses or long logs.
- Images become Assets before they are persisted in Board state.
- Board Management metadata is summary metadata, not Board document state.

## Implemented First Passes

| Capability | Status |
| --- | --- |
| Next local Asset/Board bridge | Implemented |
| FastAPI local-dev Board/Asset routes | Implemented |
| S3-compatible Asset adapter | Implemented |
| Postgres Board/Asset metadata adapter | Implemented |
| Board History create/list/load | Implemented |
| Free-tier history buckets | Autosave 100 + user saves 100 per board |
| Board Management metadata | Description, color, thumbnail, pin/star/visibility/share scaffold |
| Captured Board Thumbnail | Save-time capture when no custom thumbnail exists |
| Manual Refresh preview | Implemented and browser-smoked; writes summary thumbnail and user-save History entry |
| History thumbnail preview | Implemented and browser-smoked; `thumbnailUrl` summary only |

## Board Record Shape

Current Board summary/document contract contains:

- `id`
- `workspaceId`
- `ownerId`
- `title`
- `description`
- `cardColor`
- `document`
- `byteSize`
- `savedAt`
- `createdAt`
- `lastOpenedAt`
- `shapeCount`
- `assetCount`
- `thumbnailUrl`
- `isPinned`
- `isStarred`
- `visibility`
- `shareId`

Postgres target table: `tangent_boards`.

Current migrations include:

- `20260501_0001_p0_core_schema.py`
- `20260502_0002_board_metadata.py`
- `20260502_0003_board_management_metadata.py`

## Board History / Snapshot Shape

Product language is **Board History**; internal API/database names still use snapshot.

Current history record contains:

- `id`
- `workspaceId`
- `boardId`
- `createdBy`
- `title`
- `document`
- `documentHash`
- `byteSize`
- `assetCount`
- `shapeCount`
- `thumbnailUrl`
- `reason`
- `retentionTier`
- `expiresAt`
- `createdAt`

Reasons currently used:

- `autosave`
- `manual`
- `manual_save`
- `keyboard`
- `pre_restore`

`auto_interval` is historical compatibility only, not current default product behavior.

Retention:

- P0 free tier has autosave 100 + user saves 100 per Board.
- `TANGENT_FREE_BOARD_SNAPSHOT_LIMIT` can adjust each bucket.
- Pro/Enterprise longer retention, cold storage and object-storage history body are future billing slices.

## Asset Record Shape

Current FastAPI `AssetRecord` contains:

- `id`
- `workspaceId`
- `createdBy`
- `title`
- `origin`
- `storage`
- `mime`
- `byteSize`
- `width`
- `height`
- `createdAt`
- `originalUrl`
- `thumbnail256Url`
- `thumbnail512Url`
- `thumbnail1024Url`

Postgres target table: `tangent_assets`.

Files are local `.tangent-assets/` in local development and S3-compatible object storage later. Web-visible Board/History data stores URL metadata only, not binary payloads.

## API Contract

FastAPI production-shaped routes:

```http
GET    /api/v1/boards
POST   /api/v1/boards
GET    /api/v1/boards/{board_id}
PATCH  /api/v1/boards/{board_id}
DELETE /api/v1/boards/{board_id}
POST   /api/v1/boards/validate-document
POST   /api/v1/boards/{board_id}/snapshots
GET    /api/v1/boards/{board_id}/snapshots
GET    /api/v1/boards/{board_id}/snapshots/{snapshot_id}
POST   /api/v1/assets/upload
POST   /api/v1/assets/from-data-url
GET    /api/v1/assets/{asset_id}
GET    /api/v1/assets/files/{asset_id}/{file_name}
```

Next local bridge routes:

```http
GET  /api/boards/local-list
POST /api/boards/local-save
GET  /api/boards/local-load?boardId=...
POST /api/boards/local-rename
POST /api/boards/local-update
POST /api/boards/local-delete
POST /api/boards/local-snapshot
GET  /api/boards/local-snapshots?boardId=...
POST /api/boards/validate-document
```

Rules:

- All routes parse request context.
- `TANGENT_REQUIRE_API_AUTH=1` requires explicit local context in development.
- FastAPI storage driver supports `local-dev|postgres`.
- Asset storage driver supports `local-dev|s3-compatible`.
- Asset metadata driver supports `object-storage|postgres`.
- Unsupported drivers must fail clearly.

## Board Management Metadata

Current first pass includes:

- title
- description
- card color
- thumbnail URL/upload/remove-to-default
- star
- pin
- visibility
- share id
- details: created, modified, opened, location, object counts
- member scaffold

Owner/admin editable guard exists in UI. Editor/viewer disabled state is a UI contract only until real Auth and membership tables exist.

True share links, member persistence and permission checks wait for Auth/collaboration.

## Thumbnail Rules

- Captured thumbnail is generated as a light WebP preview.
- It is uploaded through the existing Asset API.
- Board summary stores only the returned URL.
- History summary can store `thumbnailUrl`.
- Board document and History document never store the thumbnail binary, data URL or blob URL.
- Custom thumbnail must not be overwritten by normal autosave.
- Manual Refresh preview can force recapture.

## Important Files

| Area | Files |
| --- | --- |
| Web save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `useBoardSnapshots.ts` |
| History panel | `CanvasBoardHistoryPanel.tsx`, `canvas-board-history.css` |
| Board API routes | `apps/web/src/app/api/boards/` |
| Asset API routes | `apps/web/src/app/api/assets/` |
| Board metadata | `apps/web/src/features/boards/` |
| API schemas | `services/api/tangent_api/board_schemas.py`, `board_metadata.py` |
| Storage adapters | `services/api/tangent_api/storage/` |
| Migrations | `services/api/migrations/versions/` |
| Tests | `services/api/tests/test_board_persistence_contracts.py` |

## Remaining Local Polish

- Longer autosave/history regression.
- Smart Drawing browser tuning lives in `ARCH/01-canvas-runtime.md`.
- Server-side pagination after real DB scale.

## Staging Smoke

When external resources are ready:

1. Run Alembic against staging Postgres.
2. Configure R2/S3-compatible bucket and CORS.
3. Point Web to FastAPI via `NEXT_PUBLIC_API_BASE_URL`.
4. Smoke `/health`, Asset upload/read, Board save/load, History create/list/load, guard 422.
