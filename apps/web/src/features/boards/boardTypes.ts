import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import type { SerializedBoardDocument } from './boardDocumentSerializer'

export type BoardPersistenceRecord = {
  assetCount: number
  byteSize: number
  cardColor?: BoardCardColor | null
  createdAt?: string | null
  description?: string | null
  document: unknown
  id: string
  isPinned?: boolean
  isStarred?: boolean
  lastOpenedAt?: string | null
  ownerId: string
  savedAt: string
  shapeCount: number
  shareId?: string | null
  thumbnailUrl?: string | null
  title: string
  visibility?: BoardVisibility
  workspaceId: string
}

export type BoardPersistenceSummary = Omit<BoardPersistenceRecord, 'document'>

export type BoardSaveInput<Document = unknown> = {
  boardId?: string
  cardColor?: BoardCardColor | null
  description?: string | null
  document: Document
  thumbnailUrl?: string | null
  title?: string
}

export const boardCardColorValues = ['cream', 'mint', 'peach', 'yellow', 'soft'] as const

export type BoardCardColor = typeof boardCardColorValues[number]

export const boardVisibilityValues = ['private', 'workspace', 'public'] as const

export type BoardVisibility = typeof boardVisibilityValues[number]

export type BoardRenameInput = {
  boardId: string
  title: string
}

export type BoardMetadataUpdateInput = {
  boardId: string
  cardColor?: BoardCardColor | null
  description?: string | null
  isPinned?: boolean
  isStarred?: boolean
  shareId?: string | null
  thumbnailUrl?: string | null
  title?: string
  visibility?: BoardVisibility
}

export type BoardDeleteInput = {
  boardId: string
}

export type BoardSnapshotReason = 'autosave' | 'auto_interval' | 'keyboard' | 'manual' | 'manual_save' | 'pre_restore'

export type BoardSnapshotSummary = {
  assetCount: number
  boardId: string
  byteSize: number
  createdAt: string
  createdBy: string
  documentHash: string
  expiresAt?: string | null
  id: string
  reason: BoardSnapshotReason
  retentionTier: string
  shapeCount: number
  thumbnailUrl?: string | null
  title: string
  workspaceId: string
}

export type BoardSnapshotRecord = BoardSnapshotSummary & {
  document: unknown
}

export type BoardSnapshotCreateInput<Document = unknown> = {
  boardId: string
  document: Document
  reason: BoardSnapshotReason
  thumbnailUrl?: string | null
  title?: string
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

export type BoardSnapshotCreateResponse = {
  error?: string
  ok: boolean
  snapshot?: BoardSnapshotSummary
}

export type BoardSnapshotListResponse = {
  error?: string
  ok: boolean
  snapshots: BoardSnapshotSummary[]
}

export type BoardSnapshotLoadResponse = {
  error?: string
  ok: boolean
  snapshot?: BoardSnapshotRecord
}

export type SerializedBoardSaveInput = BoardSaveInput<SerializedBoardDocument>
export type SerializedBoardSnapshotCreateInput = BoardSnapshotCreateInput<SerializedBoardDocument>

export function summarizeBoardRecord(record: BoardPersistenceRecord): BoardPersistenceSummary {
  const metrics = getBoardDocumentMetrics(record.document)
  return {
    assetCount: record.assetCount ?? metrics.assetCount,
    byteSize: record.byteSize,
    cardColor: normalizeBoardCardColor(record.cardColor),
    createdAt: record.createdAt ?? record.savedAt,
    description: normalizeBoardDescription(record.description),
    id: record.id,
    isPinned: Boolean(record.isPinned),
    isStarred: Boolean(record.isStarred),
    lastOpenedAt: record.lastOpenedAt ?? null,
    ownerId: record.ownerId,
    savedAt: record.savedAt,
    shapeCount: record.shapeCount ?? metrics.shapeCount,
    shareId: normalizeBoardShareId(record.shareId),
    thumbnailUrl: normalizeBoardThumbnailUrl(record.thumbnailUrl),
    title: record.title,
    visibility: normalizeBoardVisibility(record.visibility),
    workspaceId: record.workspaceId,
  }
}

export function normalizeBoardCardColor(value: unknown): BoardCardColor | null {
  return typeof value === 'string' && boardCardColorValues.includes(value as BoardCardColor)
    ? value as BoardCardColor
    : null
}

export function normalizeBoardDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 280) : null
}

export function normalizeBoardShareId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed) ? trimmed : null
}

export function normalizeBoardThumbnailUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/api/assets/')) return trimmed.slice(0, 512)
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed.slice(0, 512)
  return null
}

export function normalizeBoardVisibility(value: unknown): BoardVisibility {
  return typeof value === 'string' && boardVisibilityValues.includes(value as BoardVisibility)
    ? value as BoardVisibility
    : 'private'
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
