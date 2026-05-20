import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import { detectBoardCanvasEngine, type BoardCanvasEngine } from './boardCanvasEngine'
import type { WorkspaceRole } from '@/features/auth/sessionTypes'

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
  & { canvasEngine?: BoardCanvasEngine | null }

export type BoardSaveInput<Document = unknown> = {
  boardId?: string
  cardColor?: BoardCardColor | null
  createIfMissing?: boolean
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

export const boardMemberRoleValues = ['owner', 'admin', 'editor', 'viewer', 'temporary_viewer'] as const

export type BoardMemberRole = typeof boardMemberRoleValues[number]

export type BoardMemberRecord = {
  displayName?: string | null
  email?: string | null
  invitedBy?: string | null
  joinedAt: string
  role: BoardMemberRole
  userId: string
  workspaceRole?: WorkspaceRole | null
}

export type BoardMemberCreateInput = {
  boardId: string
  displayName?: string | null
  role: BoardMemberRole
  userId: string
}

export type BoardMemberUpdateInput = {
  boardId: string
  displayName?: string | null
  role?: BoardMemberRole
  userId: string
}

export type BoardMemberCandidateRecord = {
  alreadyMember: boolean
  boardRole?: BoardMemberRole | null
  displayName?: string | null
  email: string
  userId: string
  workspaceRole: WorkspaceRole
}

export type BoardShareAccessRole = 'viewer' | 'editor'

export type BoardShareLinkRecord = {
  accessRole: BoardShareAccessRole
  boardId: string
  createdAt: string
  createdBy: string
  expiresAt?: string | null
  id: string
  passwordProtected?: boolean
  shareId: string
  workspaceId: string
}

export type BoardShareLinkResolveRecord = {
  accessRole: BoardShareAccessRole
  boardId: string
  boardTitle: string
  passwordProtected?: boolean
  shareId: string
  workspaceId: string
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
  pageId?: string | null
  pageTitle?: string | null
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

export type BoardSnapshotClearResponse = {
  deletedCount: number
  error?: string
  ok: boolean
}

export type BoardMembersResponse = {
  error?: string
  members: BoardMemberRecord[]
  ok: boolean
}

export type BoardMemberResponse = {
  error?: string
  member?: BoardMemberRecord
  ok: boolean
}

export type BoardMemberDeleteResponse = {
  error?: string
  ok: boolean
  userId?: string
}

export type BoardMemberCandidatesResponse = {
  candidates: BoardMemberCandidateRecord[]
  error?: string
  ok: boolean
}

export type BoardShareLinkResponse = {
  error?: string
  ok: boolean
  shareLink?: BoardShareLinkRecord
}

export type BoardShareLinkDeleteResponse = {
  error?: string
  ok: boolean
  shareId?: string
}

export type BoardShareLinkResolveResponse = {
  error?: string
  ok: boolean
  shareLink?: BoardShareLinkResolveRecord
}

export type SerializedBoardSaveInput = BoardSaveInput<unknown>
export type SerializedBoardSnapshotCreateInput = BoardSnapshotCreateInput<unknown>

export function summarizeBoardRecord(record: BoardPersistenceRecord): BoardPersistenceSummary {
  const metrics = getBoardDocumentMetrics(record.document)
  return {
    assetCount: record.assetCount ?? metrics.assetCount,
    byteSize: record.byteSize,
    canvasEngine: detectBoardCanvasEngine(record.document),
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

export function normalizeBoardMemberRole(value: unknown): BoardMemberRole {
  return typeof value === 'string' && boardMemberRoleValues.includes(value as BoardMemberRole)
    ? value as BoardMemberRole
    : 'viewer'
}

export function getBoardDocumentMetrics(document: unknown): { assetCount: number; shapeCount: number } {
  if (!document || typeof document !== 'object') {
    return { assetCount: 0, shapeCount: 0 }
  }
  const candidate = document as { assets?: unknown; canvasDocument?: unknown; shapes?: unknown }
  const pageShapeCounts = Array.isArray((candidate as { pages?: unknown }).pages)
    ? ((candidate as { pages: unknown[] }).pages).reduce<number>((total, page) => {
        if (!page || typeof page !== 'object') return total
        const pageDocument = (page as { canvasDocument?: unknown }).canvasDocument
        const pageShapes = pageDocument && typeof pageDocument === 'object'
          ? (pageDocument as { shapes?: unknown }).shapes
          : null
        return total + (Array.isArray(pageShapes) ? pageShapes.length : 0)
      }, 0)
    : 0
  const canvasDocument = candidate.canvasDocument && typeof candidate.canvasDocument === 'object'
    ? candidate.canvasDocument as { shapes?: unknown }
    : null
  return {
    assetCount: Array.isArray(candidate.assets) ? candidate.assets.length : 0,
    shapeCount: pageShapeCounts > 0
      ? pageShapeCounts
      : Array.isArray(candidate.shapes)
      ? candidate.shapes.length
      : Array.isArray(canvasDocument?.shapes) ? canvasDocument.shapes.length : 0,
  }
}
