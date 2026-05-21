import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import { detectBoardCanvasEngine, type BoardCanvasEngine } from './boardCanvasEngine'
import type { WorkspaceRole } from '@/features/auth/sessionTypes'
import { coerceBoardTitle } from './boardTitle'
import {
  getBoardDocumentMetrics,
  normalizeBoardCardColor,
  normalizeBoardDescription,
  normalizeBoardShareId,
  normalizeBoardThumbnailUrl,
  normalizeBoardVisibility,
  type BoardCardColor,
  type BoardMemberRole,
  type BoardVisibility,
} from './boardMetadata'

export {
  boardCardColorValues,
  boardMemberRoleValues,
  boardVisibilityValues,
  getBoardDocumentMetrics,
  normalizeBoardCardColor,
  normalizeBoardDescription,
  normalizeBoardMemberRole,
  normalizeBoardShareId,
  normalizeBoardThumbnailUrl,
  normalizeBoardVisibility,
} from './boardMetadata'
export type { BoardCardColor, BoardMemberRole, BoardVisibility } from './boardMetadata'

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
    title: coerceBoardTitle(record.title),
    visibility: normalizeBoardVisibility(record.visibility),
    workspaceId: record.workspaceId,
  }
}
