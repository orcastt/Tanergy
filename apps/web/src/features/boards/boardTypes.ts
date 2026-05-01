import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import type { SerializedBoardDocument } from './boardDocumentSerializer'

export type BoardPersistenceRecord = {
  assetCount: number
  byteSize: number
  document: unknown
  id: string
  ownerId: string
  savedAt: string
  shapeCount: number
  thumbnailUrl?: string | null
  title: string
  workspaceId: string
}

export type BoardPersistenceSummary = Omit<BoardPersistenceRecord, 'document'>

export type BoardSaveInput<Document = unknown> = {
  boardId?: string
  document: Document
  title?: string
}

export type BoardRenameInput = {
  boardId: string
  title: string
}

export type BoardDeleteInput = {
  boardId: string
}

export type BoardSaveResponse = {
  audit?: BoardDocumentGuardResult
  board?: BoardPersistenceSummary
  error?: string
  ok: boolean
}

export type BoardLoadResponse = {
  board?: BoardPersistenceRecord
  error?: string
  ok: boolean
}

export type BoardListResponse = {
  boards: BoardPersistenceSummary[]
  error?: string
  ok: boolean
}

export type BoardRenameResponse = {
  board?: BoardPersistenceSummary
  error?: string
  ok: boolean
}

export type BoardDeleteResponse = {
  boardId?: string
  error?: string
  ok: boolean
}

export type SerializedBoardSaveInput = BoardSaveInput<SerializedBoardDocument>

export function summarizeBoardRecord(record: BoardPersistenceRecord): BoardPersistenceSummary {
  const metrics = getBoardDocumentMetrics(record.document)
  return {
    assetCount: record.assetCount ?? metrics.assetCount,
    byteSize: record.byteSize,
    id: record.id,
    ownerId: record.ownerId,
    savedAt: record.savedAt,
    shapeCount: record.shapeCount ?? metrics.shapeCount,
    thumbnailUrl: record.thumbnailUrl ?? null,
    title: record.title,
    workspaceId: record.workspaceId,
  }
}

export function getBoardDocumentMetrics(document: unknown) {
  if (!document || typeof document !== 'object') {
    return { assetCount: 0, shapeCount: 0 }
  }
  const candidate = document as { assets?: unknown; shapes?: unknown }
  return {
    assetCount: Array.isArray(candidate.assets) ? candidate.assets.length : 0,
    shapeCount: Array.isArray(candidate.shapes) ? candidate.shapes.length : 0,
  }
}
