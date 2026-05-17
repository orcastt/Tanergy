'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import type { CanvasDocument } from '@/features/canvas-engine'
import { createGuardedKonvaBoardDocument, type KonvaBoardDocumentSerializationOptions } from '@/features/boards/konvaBoardDocument'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getDocumentSignature } from '@/components/canvas/boardSaveStatus'
import type { BoardRealtimeDocumentState } from '@/features/collaboration/boardRealtimeTransport'
import { readKonvaYjsRoomRecordSafely } from '@/features/collaboration/konvaYjsRoomRecordHelpers'
import { type KonvaYjsRoomRecord, type KonvaYjsSnapshotWriteMode } from '@/features/collaboration/konvaYjsSnapshot'
import {
  createLocalYjsActorId,
  createLocalYjsSyncState,
  type KonvaLocalYjsRemoteRestoreMeta,
  type KonvaLocalYjsRemoteRestorePayload,
  type KonvaLocalYjsSyncController,
  type KonvaLocalYjsSyncStatus,
} from './konvaLocalYjsSyncContract'
import { applyIncomingKonvaYjsSnapshot, publishCurrentKonvaYjsSnapshot, refreshPendingRemoteSnapshot } from './konvaLocalYjsSnapshotFlow'
import { type PendingRemoteSnapshotMeta } from './konvaLocalYjsSyncHelpers'
import { useKonvaLocalYjsPublishScheduler } from './useKonvaLocalYjsPublishScheduler'

type UseKonvaLocalYjsSnapshotControllerOptions = {
  activePageId?: string
  canWrite: boolean
  clientInstanceId?: string | null
  document: CanvasDocument
  getPageEnvelope: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  initialStatus: KonvaLocalYjsSyncStatus
  onRemoteDocumentRestore: (document: KonvaLocalYjsRemoteRestorePayload, meta: KonvaLocalYjsRemoteRestoreMeta) => void
  pageChangedPageIds?: string[]
  pageRevision?: number
  requiresFullBoardSync?: boolean
  resolvedRoomKey: string | null
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

export function useKonvaLocalYjsSnapshotController({
  activePageId,
  canWrite,
  clientInstanceId = null,
  document,
  getPageEnvelope,
  initialStatus,
  onRemoteDocumentRestore,
  pageChangedPageIds = [],
  pageRevision = 0,
  requiresFullBoardSync = false,
  resolvedRoomKey,
  workspace,
  ydoc,
}: UseKonvaLocalYjsSnapshotControllerOptions) {
  const [syncState, setSyncState] = useState<KonvaLocalYjsSyncController>(() => createLocalYjsSyncState(initialStatus, null))
  const actorIdRef = useRef<string>(clientInstanceId?.trim() || createLocalYjsActorId())
  const localOriginRef = useRef(Symbol('tangent-local-yjs-origin'))
  const latestDocumentRef = useRef(document)
  const latestGetPageEnvelopeRef = useRef(getPageEnvelope)
  const latestCanWriteRef = useRef(canWrite)
  const latestActivePageIdRef = useRef(activePageId)
  const latestRemoteRestoreRef = useRef(onRemoteDocumentRestore)
  const lastSynchronizedSignatureRef = useRef<string | null>(null)
  const lastSynchronizedPagesRef = useRef<SerializedKonvaBoardPage[] | null>(null)
  const pendingRemoteSnapshotRef = useRef<PendingRemoteSnapshotMeta | null>(null)
  const publishTimerRef = useRef<number | null>(null)
  const publishCurrentSnapshotRef = useRef<((options?: { force?: boolean; mode?: KonvaYjsSnapshotWriteMode }) => void) | null>(null)
  const hasUnsyncedLocalChangesRef = useRef(false)
  const nextChangedPageIdsRef = useRef<string[]>(activePageId ? [activePageId] : [])
  const nextPublishModeRef = useRef<KonvaYjsSnapshotWriteMode>('full-board')
  const skipNextPublishRef = useRef(false)
  const lastObservedActivePageIdRef = useRef<string | undefined>(activePageId)
  const lastObservedPageRevisionRef = useRef(pageRevision)
  const initialSyncSettledRef = useRef(false)
  const realtimeStatusRef = useRef<KonvaLocalYjsSyncStatus>(initialStatus)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)
  const lastPublishedAtRef = useRef<string | null>(null)

  const patchSyncState = useCallback((patch: Partial<KonvaLocalYjsSyncController>) => {
    setSyncState((current) => ({ ...current, ...patch }))
  }, [])
  useEffect(() => {
    latestDocumentRef.current = document
    latestGetPageEnvelopeRef.current = getPageEnvelope
    latestCanWriteRef.current = canWrite
    latestActivePageIdRef.current = activePageId
    latestRemoteRestoreRef.current = onRemoteDocumentRestore
  }, [activePageId, canWrite, document, getPageEnvelope, onRemoteDocumentRestore])

  const cancelScheduledPublish = useCallback(() => {
    if (publishTimerRef.current === null) return
    window.clearTimeout(publishTimerRef.current)
    publishTimerRef.current = null
  }, [])
  const updateRealtimeStatus = useCallback((transportState: BoardRealtimeDocumentState) => {
    realtimeStatusRef.current = transportState.status
    patchSyncState({
      status: transportState.status,
      transportState,
    })
  }, [patchSyncState])
  const clearPendingRemoteSnapshot = useCallback(() => {
    pendingRemoteSnapshotRef.current = null
    patchSyncState({
      hasPendingRemoteSnapshot: false,
      pendingRemoteActorId: null,
    })
  }, [patchSyncState])
  const setHasUnsyncedLocalChanges = useCallback((value: boolean) => { hasUnsyncedLocalChangesRef.current = value }, [])
  const setPendingRemoteSnapshot = useCallback((pending: PendingRemoteSnapshotMeta | null) => { pendingRemoteSnapshotRef.current = pending }, [])
  const markSkipNextPublish = useCallback(() => { skipNextPublishRef.current = true }, [])
  const syncUndoAvailability = useCallback((undoManager: Y.UndoManager | null = undoManagerRef.current) => {
    patchSyncState({
      canRedo: Boolean(undoManager?.canRedo()),
      canUndo: Boolean(undoManager?.canUndo()),
    })
  }, [patchSyncState])
  const rememberSynchronizedRecord = useCallback((record: KonvaYjsRoomRecord) => {
    lastSynchronizedSignatureRef.current = record.signature; lastSynchronizedPagesRef.current = record.pages
  }, [])
  const readRoomRecordSafely = useCallback(() => readKonvaYjsRoomRecordSafely(ydoc), [ydoc])
  const readCurrentDocumentSignature = useCallback(() => {
    try {
      const nextResult = createGuardedKonvaBoardDocument(
        latestDocumentRef.current,
        latestGetPageEnvelopeRef.current(latestDocumentRef.current),
      )
      return nextResult.audit.ok ? getDocumentSignature(nextResult.document) : null
    } catch {
      return null
    }
  }, [])
  const applySnapshotRecord = useCallback((record: KonvaYjsRoomRecord, options: { force?: boolean } = {}) => {
    applyIncomingKonvaYjsSnapshot({
      cancelScheduledPublish,
      canWrite: latestCanWriteRef.current,
      clearPendingRemoteSnapshot,
      currentDocumentSignature: readCurrentDocumentSignature(),
      force: options.force,
      hasSynchronizedPages: lastSynchronizedPagesRef.current !== null,
      hasUnsyncedLocalChanges: hasUnsyncedLocalChangesRef.current,
      lastSynchronizedSignature: lastSynchronizedSignatureRef.current,
      localChangedPageIds: nextChangedPageIdsRef.current,
      localPublishMode: nextPublishModeRef.current,
      markSkipNextPublish,
      onRemoteRestore: latestRemoteRestoreRef.current,
      onRepublishLocal: () => publishCurrentSnapshotRef.current?.({
        force: true,
        mode: nextPublishModeRef.current,
      }),
      patchSyncState,
      previousPages: lastSynchronizedPagesRef.current,
      record,
      rememberSynchronizedRecord,
      setHasUnsyncedLocalChanges,
      setPendingRemoteSnapshot,
      workspaceKind: workspace?.kind,
    })
  }, [cancelScheduledPublish, clearPendingRemoteSnapshot, markSkipNextPublish, patchSyncState, readCurrentDocumentSignature, rememberSynchronizedRecord, setHasUnsyncedLocalChanges, setPendingRemoteSnapshot, workspace?.kind])
  const maybeApplyCurrentSnapshot = useCallback(() => {
    const pending = pendingRemoteSnapshotRef.current
    const current = readRoomRecordSafely()
    if (pending && current?.signature === pending.signature) {
      applySnapshotRecord(current)
      return
    }
    pendingRemoteSnapshotRef.current = null
    if (current) applySnapshotRecord(current)
  }, [applySnapshotRecord, readRoomRecordSafely])
  const publishCurrentSnapshot = useCallback((options: { force?: boolean; mode?: KonvaYjsSnapshotWriteMode } = {}) => {
    lastPublishedAtRef.current = publishCurrentKonvaYjsSnapshot({
      actorId: actorIdRef.current,
      activePageId: latestActivePageIdRef.current,
      canWrite: latestCanWriteRef.current,
      currentDocument: latestDocumentRef.current,
      force: options.force,
      getPageEnvelope: latestGetPageEnvelopeRef.current,
      hasUnsyncedLocalChanges: hasUnsyncedLocalChangesRef.current,
      initialSyncSettled: initialSyncSettledRef.current,
      lastPublishedAt: lastPublishedAtRef.current,
      lastSynchronizedPages: lastSynchronizedPagesRef.current,
      lastSynchronizedSignature: lastSynchronizedSignatureRef.current,
      localOrigin: localOriginRef.current,
      mode: options.mode,
      nextChangedPageIds: nextChangedPageIdsRef.current,
      onInvalidDocument: maybeApplyCurrentSnapshot,
      onMaybeApplyCurrentSnapshot: maybeApplyCurrentSnapshot,
      patchSyncState,
      pendingRemoteSnapshot: pendingRemoteSnapshotRef.current,
      rememberSynchronizedRecord,
      resolvedRoomKey,
      setHasUnsyncedLocalChanges,
      setPendingRemoteSnapshot,
      status: realtimeStatusRef.current,
      syncUndoAvailability,
      undoManager: undoManagerRef.current,
      ydoc,
    })
  }, [maybeApplyCurrentSnapshot, patchSyncState, rememberSynchronizedRecord, resolvedRoomKey, setHasUnsyncedLocalChanges, setPendingRemoteSnapshot, syncUndoAvailability, ydoc])
  useEffect(() => {
    publishCurrentSnapshotRef.current = publishCurrentSnapshot
    return () => { if (publishCurrentSnapshotRef.current === publishCurrentSnapshot) publishCurrentSnapshotRef.current = null }
  }, [publishCurrentSnapshot])
  const applyPendingRemoteSnapshot = useCallback(() => {
    cancelScheduledPublish()
    setHasUnsyncedLocalChanges(false)
    patchSyncState({ hasUnsyncedLocalChanges: false })
    const pending = pendingRemoteSnapshotRef.current
    const current = readRoomRecordSafely()
    if (!current) {
      clearPendingRemoteSnapshot()
      return
    }
    setPendingRemoteSnapshot(refreshPendingRemoteSnapshot(pending, current))
    applySnapshotRecord(current, { force: true })
  }, [applySnapshotRecord, cancelScheduledPublish, clearPendingRemoteSnapshot, patchSyncState, readRoomRecordSafely, setHasUnsyncedLocalChanges, setPendingRemoteSnapshot])
  const publishLocalSnapshot = useCallback(() => {
    cancelScheduledPublish()
    publishCurrentSnapshot({ force: true, mode: nextPublishModeRef.current })
  }, [cancelScheduledPublish, publishCurrentSnapshot])
  const undoLocalChange = useCallback(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    cancelScheduledPublish()
    setHasUnsyncedLocalChanges(false)
    patchSyncState({ hasUnsyncedLocalChanges: false })
    undoManagerRef.current?.undo()
    syncUndoAvailability()
  }, [cancelScheduledPublish, patchSyncState, resolvedRoomKey, setHasUnsyncedLocalChanges, syncUndoAvailability])
  const redoLocalChange = useCallback(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    cancelScheduledPublish()
    setHasUnsyncedLocalChanges(false)
    patchSyncState({ hasUnsyncedLocalChanges: false })
    undoManagerRef.current?.redo()
    syncUndoAvailability()
  }, [cancelScheduledPublish, patchSyncState, resolvedRoomKey, setHasUnsyncedLocalChanges, syncUndoAvailability])
  useKonvaLocalYjsPublishScheduler({
    activePageId,
    cancelScheduledPublish,
    latestCanWriteRef,
    nextChangedPageIdsRef,
    nextPublishModeRef,
    lastObservedActivePageIdRef,
    lastObservedPageRevisionRef,
    patchSyncState,
    pageChangedPageIds,
    pageRevision,
    publishCurrentSnapshot,
    publishTimerRef,
    requiresFullBoardSync,
    resolvedRoomKey,
    setHasUnsyncedLocalChanges,
    skipNextPublishRef,
  })
  return {
    actorIdRef,
    applyPendingRemoteSnapshot,
    applySnapshotRecord,
    cancelScheduledPublish,
    hasUnsyncedLocalChangesRef,
    initialSyncSettledRef,
    localOriginRef,
    patchSyncState,
    pendingRemoteSnapshotRef,
    publishCurrentSnapshot,
    publishLocalSnapshot,
    readRoomRecordSafely,
    realtimeStatusRef,
    redoLocalChange,
    syncState,
    syncUndoAvailability,
    undoLocalChange,
    undoManagerRef,
    updateRealtimeStatus,
    lastSynchronizedPagesRef,
    lastSynchronizedSignatureRef,
    latestCanWriteRef,
    nextPublishModeRef,
  }
}
