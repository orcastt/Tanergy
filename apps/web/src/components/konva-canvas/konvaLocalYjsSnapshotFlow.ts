'use client'

import * as Y from 'yjs'
import type { CanvasDocument } from '@/features/canvas-engine'
import { getDocumentSignature } from '@/components/canvas/boardSaveStatus'
import {
  createGuardedKonvaBoardDocument,
  type KonvaBoardDocumentSerializationOptions,
} from '@/features/boards/konvaBoardDocument'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import {
  writeKonvaYjsSnapshot,
  type KonvaYjsRoomRecord,
  type KonvaYjsSnapshotWriteMode,
} from '@/features/collaboration/konvaYjsSnapshot'
import {
  createRemoteRestorePayload,
  type KonvaLocalYjsRemoteRestoreMeta,
  type KonvaLocalYjsRemoteRestorePayload,
  type KonvaLocalYjsSyncController,
  type KonvaLocalYjsSyncStatus,
} from './konvaLocalYjsSyncContract'
import {
  createPendingRemoteSnapshotMeta,
  resolveKonvaYjsIncomingRecord,
  type PendingRemoteSnapshotMeta,
} from './konvaLocalYjsSyncHelpers'

type PatchSyncState = (patch: Partial<KonvaLocalYjsSyncController>) => void

type ApplyIncomingKonvaYjsSnapshotOptions = {
  cancelScheduledPublish: () => void
  canWrite: boolean
  clearPendingRemoteSnapshot: () => void
  currentDocumentSignature: string | null
  force?: boolean
  hasSynchronizedPages: boolean
  hasUnsyncedLocalChanges: boolean
  lastSynchronizedSignature: string | null
  localChangedPageIds: readonly string[]
  localPublishMode: KonvaYjsSnapshotWriteMode
  markSkipNextPublish: () => void
  onRemoteRestore: (document: KonvaLocalYjsRemoteRestorePayload, meta: KonvaLocalYjsRemoteRestoreMeta) => void
  onRepublishLocal: () => void
  patchSyncState: PatchSyncState
  previousPages: SerializedKonvaBoardPage[] | null
  record: KonvaYjsRoomRecord
  rememberSynchronizedRecord: (record: KonvaYjsRoomRecord) => void
  setHasUnsyncedLocalChanges: (value: boolean) => void
  setPendingRemoteSnapshot: (pending: PendingRemoteSnapshotMeta | null) => void
  workspaceKind?: string
}

export function applyIncomingKonvaYjsSnapshot({
  cancelScheduledPublish,
  canWrite,
  clearPendingRemoteSnapshot,
  currentDocumentSignature,
  force = false,
  hasSynchronizedPages,
  hasUnsyncedLocalChanges,
  lastSynchronizedSignature,
  localChangedPageIds,
  localPublishMode,
  markSkipNextPublish,
  onRemoteRestore,
  onRepublishLocal,
  patchSyncState,
  previousPages,
  record,
  rememberSynchronizedRecord,
  setHasUnsyncedLocalChanges,
  setPendingRemoteSnapshot,
  workspaceKind,
}: ApplyIncomingKonvaYjsSnapshotOptions) {
  const decision = resolveKonvaYjsIncomingRecord({
    canWrite,
    currentDocumentSignature,
    force,
    hasUnsyncedLocalChanges,
    hasSynchronizedPages,
    lastSynchronizedSignature,
    localChangedPageIds,
    localPublishMode,
    record,
    workspaceKind,
  })
  if (decision.kind === 'duplicate') {
    rememberSynchronizedRecord(record)
    clearPendingRemoteSnapshot()
    return
  }
  if (decision.kind === 'already-current') {
    rememberSynchronizedRecord(record)
    setPendingRemoteSnapshot(null)
    setHasUnsyncedLocalChanges(false)
    patchSyncState({
      hasPendingRemoteSnapshot: false,
      hasUnsyncedLocalChanges: false,
      lastRemotePublishedAt: record.publishedAt,
      pendingRemoteActorId: null,
    })
    return
  }
  if (decision.kind === 'republish-local') {
    onRepublishLocal()
    return
  }
  if (decision.kind === 'queue-pending') {
    setPendingRemoteSnapshot(decision.pending)
    cancelScheduledPublish()
    patchSyncState({
      hasPendingRemoteSnapshot: true,
      lastRemotePublishedAt: record.publishedAt,
      pendingRemoteActorId: record.actorId,
    })
    return
  }
  try {
    rememberSynchronizedRecord(record)
    setPendingRemoteSnapshot(null)
    setHasUnsyncedLocalChanges(false)
    patchSyncState({
      hasPendingRemoteSnapshot: false,
      hasUnsyncedLocalChanges: false,
      lastRemoteAppliedAt: new Date().toISOString(),
      lastRemotePublishedAt: record.publishedAt,
      pendingRemoteActorId: null,
    })
    markSkipNextPublish()
    onRemoteRestore(createRemoteRestorePayload(record), {
      activePageId: record.activePageId,
      actorId: record.actorId,
      basePages: previousPages,
      changedPageIds: record.changedPageIds,
      mode: record.mode,
      publishedAt: record.publishedAt,
      signature: record.signature,
    })
  } catch {
    clearPendingRemoteSnapshot()
  }
}

type PublishCurrentKonvaYjsSnapshotOptions = {
  actorId: string
  activePageId?: string
  canWrite: boolean
  currentDocument: CanvasDocument
  force?: boolean
  getPageEnvelope: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  hasUnsyncedLocalChanges: boolean
  initialSyncSettled: boolean
  lastPublishedAt: string | null
  lastSynchronizedPages: SerializedKonvaBoardPage[] | null
  lastSynchronizedSignature: string | null
  localOrigin: symbol
  mode?: KonvaYjsSnapshotWriteMode
  nextChangedPageIds: string[]
  patchSyncState: PatchSyncState
  pendingRemoteSnapshot: PendingRemoteSnapshotMeta | null
  rememberSynchronizedRecord: (record: KonvaYjsRoomRecord) => void
  resolvedRoomKey: string | null
  setHasUnsyncedLocalChanges: (value: boolean) => void
  setPendingRemoteSnapshot: (pending: PendingRemoteSnapshotMeta | null) => void
  status: KonvaLocalYjsSyncStatus
  syncUndoAvailability: () => void
  undoManager: Y.UndoManager | null
  ydoc: Y.Doc
  onInvalidDocument: () => void
  onMaybeApplyCurrentSnapshot: () => void
}

export function publishCurrentKonvaYjsSnapshot({
  actorId,
  activePageId,
  canWrite,
  currentDocument,
  force = false,
  getPageEnvelope,
  hasUnsyncedLocalChanges,
  initialSyncSettled,
  lastPublishedAt,
  lastSynchronizedPages,
  lastSynchronizedSignature,
  localOrigin,
  mode = 'full-board',
  nextChangedPageIds,
  patchSyncState,
  pendingRemoteSnapshot,
  rememberSynchronizedRecord,
  resolvedRoomKey,
  setHasUnsyncedLocalChanges,
  setPendingRemoteSnapshot,
  status,
  syncUndoAvailability,
  undoManager,
  ydoc,
  onInvalidDocument,
  onMaybeApplyCurrentSnapshot,
}: PublishCurrentKonvaYjsSnapshotOptions): string | null {
  if (!resolvedRoomKey || !canWrite) {
    onMaybeApplyCurrentSnapshot()
    return lastPublishedAt
  }
  if (!initialSyncSettled) {
    patchSyncState({
      hasUnsyncedLocalChanges,
      status,
    })
    return lastPublishedAt
  }
  if (!force && pendingRemoteSnapshot) {
    patchSyncState({
      hasPendingRemoteSnapshot: true,
      hasUnsyncedLocalChanges,
    })
    return lastPublishedAt
  }
  const nextResult = createGuardedKonvaBoardDocument(currentDocument, getPageEnvelope(currentDocument))
  if (!nextResult.audit.ok) {
    onInvalidDocument()
    return lastPublishedAt
  }
  const signature = getDocumentSignature(nextResult.document)
  const publishedAt = new Date().toISOString()
  let nextLastPublishedAt = lastPublishedAt
  const wasUninitialized = lastSynchronizedPages === null
  if (force || signature !== lastSynchronizedSignature) {
    const changedPageIds = mode === 'active-page' && activePageId
      ? [activePageId]
      : nextChangedPageIds
    const synchronizedRecord = writeKonvaYjsSnapshot(ydoc, {
      activePageId,
      actorId,
      canvasSettings: nextResult.document.canvasSettings,
      changedPageIds,
      mode,
      pages: nextResult.document.pages ?? [],
      publishedAt,
      serializedAt: nextResult.document.serializedAt,
      signature,
    }, localOrigin, {
      activePageId,
      basePages: lastSynchronizedPages,
      changedPageIds,
      mode,
    })
    rememberSynchronizedRecord(synchronizedRecord)
    nextLastPublishedAt = publishedAt
    if (wasUninitialized) {
      undoManager?.clear()
      syncUndoAvailability()
    }
  }
  setPendingRemoteSnapshot(null)
  setHasUnsyncedLocalChanges(false)
  patchSyncState({
    hasPendingRemoteSnapshot: false,
    hasUnsyncedLocalChanges: false,
    lastPublishedAt: nextLastPublishedAt,
    pendingRemoteActorId: null,
    status,
  })
  onMaybeApplyCurrentSnapshot()
  return nextLastPublishedAt
}

export function refreshPendingRemoteSnapshot(
  pending: PendingRemoteSnapshotMeta | null,
  current: KonvaYjsRoomRecord | null,
): PendingRemoteSnapshotMeta | null {
  if (!pending || !current || current.signature === pending.signature) return pending
  return createPendingRemoteSnapshotMeta(current)
}
