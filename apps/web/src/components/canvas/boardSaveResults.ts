import type { BoardPersistenceRecord, BoardSnapshotRecord } from '@/features/boards/boardTypes'
import type { LocalBoardSaveResponse } from '@/features/boards/localBoardClient'

type RestoreMetrics = {
  assetCount: number
  shapeCount: number
}

export function createLoadedBoardSaveResponse(
  board: BoardPersistenceRecord,
  restore: RestoreMetrics
): LocalBoardSaveResponse {
  return {
    board: {
      assetCount: board.assetCount ?? restore.assetCount,
      byteSize: board.byteSize,
      id: board.id,
      lastOpenedAt: board.lastOpenedAt ?? null,
      ownerId: board.ownerId,
      savedAt: board.savedAt,
      shapeCount: board.shapeCount ?? restore.shapeCount,
      thumbnailUrl: board.thumbnailUrl ?? null,
      title: `${restore.shapeCount} shape(s) loaded from ${board.title}`,
      workspaceId: board.workspaceId,
    },
    ok: true,
  }
}

export function createRestoredHistorySaveResponse(snapshot: BoardSnapshotRecord): LocalBoardSaveResponse {
  return {
    board: {
      assetCount: snapshot.assetCount,
      byteSize: snapshot.byteSize,
      id: snapshot.boardId,
      lastOpenedAt: null,
      ownerId: snapshot.createdBy,
      savedAt: snapshot.createdAt,
      shapeCount: snapshot.shapeCount,
      thumbnailUrl: snapshot.thumbnailUrl ?? null,
      title: `Restored from ${snapshot.title}`,
      workspaceId: snapshot.workspaceId,
    },
    ok: true,
  }
}
