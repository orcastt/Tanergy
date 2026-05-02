# Board / Asset Persistence Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.2, 5, 8, 11.5.1

## Current Boundary

- Board list returns summary only, never full document.
- Board load returns document and must be workspace/user scoped.
- Board save runs guard before persistence.
- Board History documents run the same guard.
- History list returns summary only; history load returns full document.
- Board documents may store lightweight `canvasSettings`.
- Board documents may not store `data:`, `blob:`, Base64 image payloads, provider raw responses or long logs.
- Images become Assets before they are persisted in Board state.

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
| Captured Board Thumbnail | Save-time first pass when no custom thumbnail exists |

## Important Files

| Area | Files |
| --- | --- |
| Web save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `useBoardSnapshots.ts` |
| Board API routes | `apps/web/src/app/api/boards/` |
| Asset API routes | `apps/web/src/app/api/assets/` |
| Board metadata | `apps/web/src/features/boards/` |
| API schemas | `services/api/tangent_api/board_schemas.py`, `board_metadata.py` |
| Storage adapters | `services/api/tangent_api/storage/` |
| Tests | `services/api/tests/test_board_persistence_contracts.py` |

## Remaining Local Polish

- Manual thumbnail refresh.
- History entry thumbnail preview.
- Longer autosave/history browser regression.
- Server-side pagination after real DB scale.

## Staging Smoke

When external resources are ready:

1. Run Alembic against staging Postgres.
2. Configure R2/S3-compatible bucket and CORS.
3. Point Web to FastAPI via `NEXT_PUBLIC_API_BASE_URL`.
4. Smoke `/health`, Asset upload/read, Board save/load, History create/list/load, guard 422.
