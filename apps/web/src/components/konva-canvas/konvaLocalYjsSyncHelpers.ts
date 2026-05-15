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
  lastSynchronizedSignature: string | null
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
  lastSynchronizedSignature,
  record,
  workspaceKind,
}: ResolveKonvaYjsIncomingRecordOptions): KonvaYjsIncomingRecordDecision {
  if (record.signature === lastSynchronizedSignature) return { kind: 'duplicate' }
  if (record.signature === currentDocumentSignature) return { kind: 'already-current' }
  if (!force && workspaceKind === 'solo_workspace' && canWrite && hasUnsyncedLocalChanges) {
    return { kind: 'republish-local' }
  }
  if (!force && canWrite && hasUnsyncedLocalChanges) {
    return {
      kind: 'queue-pending',
      pending: createPendingRemoteSnapshotMeta(record),
    }
  }
  return { kind: 'restore-remote' }
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
