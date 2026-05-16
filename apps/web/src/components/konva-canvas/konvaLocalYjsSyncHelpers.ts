import { dedupeKonvaPageIds } from '@/features/collaboration/konvaYjsRoomRecordHelpers'
import type { KonvaYjsRoomRecord, KonvaYjsSnapshotWriteMode } from '@/features/collaboration/konvaYjsSnapshot'

export type PendingRemoteSnapshotMeta = Pick<KonvaYjsRoomRecord, 'actorId' | 'publishedAt' | 'signature'>

export type KonvaYjsIncomingRecordDecision =
  | { kind: 'already-current' }
  | { kind: 'duplicate' }
  | { kind: 'queue-pending'; pending: PendingRemoteSnapshotMeta }
  | { kind: 'republish-local' }
  | { kind: 'restore-remote' }

type ResolveKonvaYjsIncomingRecordOptions = {
  canWrite: boolean
  currentDocumentSignature: string | null
  force?: boolean
  hasUnsyncedLocalChanges: boolean
  hasSynchronizedPages: boolean
  lastSynchronizedSignature: string | null
  localChangedPageIds?: readonly string[]
  localPublishMode?: KonvaYjsSnapshotWriteMode
  record: KonvaYjsRoomRecord
  workspaceKind?: string
}

type ResolveKonvaYjsPublishPlanOptions = {
  activePageId?: string
  pageChangedPageIds?: readonly string[]
  pageRevision: number
  previousActivePageId?: string
  previousPageRevision: number
  requiresFullBoardSync: boolean
}

export type KonvaYjsPublishPlan = {
  changedPageIds: string[]
  didRevisionChange: boolean
  didSwitchPage: boolean
  mode: KonvaYjsSnapshotWriteMode
}

export function createPendingRemoteSnapshotMeta(record: KonvaYjsRoomRecord): PendingRemoteSnapshotMeta {
  return {
    actorId: record.actorId,
    publishedAt: record.publishedAt,
    signature: record.signature,
  }
}

export function resolveKonvaYjsIncomingRecord({
  canWrite,
  currentDocumentSignature,
  force = false,
  hasUnsyncedLocalChanges,
  hasSynchronizedPages,
  lastSynchronizedSignature,
  localChangedPageIds = [],
  localPublishMode = 'full-board',
  record,
  workspaceKind,
}: ResolveKonvaYjsIncomingRecordOptions): KonvaYjsIncomingRecordDecision {
  if (record.signature === lastSynchronizedSignature) return { kind: 'duplicate' }
  if (record.signature === currentDocumentSignature) return { kind: 'already-current' }
  if (!force && workspaceKind === 'solo_workspace' && canWrite && hasUnsyncedLocalChanges) {
    return { kind: 'republish-local' }
  }
  if (
    !force
    && canWrite
    && hasUnsyncedLocalChanges
    && canOptimisticallyRestoreIncomingRecord({
      hasSynchronizedPages,
      localChangedPageIds,
      localPublishMode,
      record,
    })
  ) {
    return { kind: 'restore-remote' }
  }
  if (!force && canWrite && hasUnsyncedLocalChanges) {
    return {
      kind: 'queue-pending',
      pending: createPendingRemoteSnapshotMeta(record),
    }
  }
  return { kind: 'restore-remote' }
}

function canOptimisticallyRestoreIncomingRecord(options: {
  hasSynchronizedPages: boolean
  localChangedPageIds: readonly string[]
  localPublishMode: KonvaYjsSnapshotWriteMode
  record: KonvaYjsRoomRecord
}) {
  if (!options.hasSynchronizedPages) return false
  const localChangedPageIds = dedupeKonvaPageIds(options.localChangedPageIds)
  const incomingChangedPageIds = dedupeKonvaPageIds(options.record.changedPageIds)
  if (localChangedPageIds.length === 0 || incomingChangedPageIds.length === 0) return false
  if (options.localPublishMode === 'full-board' || options.record.mode === 'full-board') return false
  const localChangedPageIdSet = new Set(localChangedPageIds)
  return !incomingChangedPageIds.some((pageId) => localChangedPageIdSet.has(pageId))
}

export function resolveKonvaYjsPublishPlan({
  activePageId,
  pageChangedPageIds = [],
  pageRevision,
  previousActivePageId,
  previousPageRevision,
  requiresFullBoardSync,
}: ResolveKonvaYjsPublishPlanOptions): KonvaYjsPublishPlan {
  const didSwitchPage = activePageId !== previousActivePageId
  const didRevisionChange = pageRevision !== previousPageRevision
  // Page switches without content edits only publish the active page pointer.
  // Real document edits stay page-scoped until a caller explicitly requests a full-board sync.
  return {
    changedPageIds: didRevisionChange
      ? dedupeKonvaPageIds(pageChangedPageIds)
      : dedupeKonvaPageIds(activePageId ? [activePageId] : []),
    didRevisionChange,
    didSwitchPage,
    mode: didRevisionChange
      ? (requiresFullBoardSync ? 'full-board' : 'page-batch')
      : 'active-page',
  }
}
