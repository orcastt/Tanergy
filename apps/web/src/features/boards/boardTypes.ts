import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import type { SerializedBoardDocument } from './boardDocumentSerializer'

export type BoardPersistenceRecord = {
  byteSize: number
  document: unknown
  id: string
  ownerId: string
  savedAt: string
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
  return {
    byteSize: record.byteSize,
    id: record.id,
    ownerId: record.ownerId,
    savedAt: record.savedAt,
    title: record.title,
    workspaceId: record.workspaceId,
  }
}
