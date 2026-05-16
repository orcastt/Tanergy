'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import type { CanvasDocument } from '@/features/canvas-engine'
import { createGuardedKonvaBoardDocument, type KonvaBoardDocumentSerializationOptions, type SerializedKonvaBoardDocument } from '@/features/boards/konvaBoardDocument'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getDocumentSignature } from '@/components/canvas/boardSaveStatus'
import {
  type BoardRealtimeDocumentConnection,
  type BoardRealtimeDocumentState,
  type BoardRealtimeDocumentStatus,
  connectBoardRealtimeYjsDocument,
  createBoardRealtimeRoomDescriptor,
  hasSupportedBoardRealtimeTransport,
} from '@/features/collaboration/boardRealtimeTransport'
import {
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
} from '@/features/collaboration/boardRealtimeState'
import {
  readKonvaYjsRoomRecordSafely,
} from '@/features/collaboration/konvaYjsRoomRecordHelpers'
import {
  createKonvaYjsUndoManager,
  type KonvaYjsRoomRecord,
  writeKonvaYjsSnapshot,
  type KonvaYjsSnapshotWriteMode,
} from '@/features/collaboration/konvaYjsSnapshot'
import {
  createPendingRemoteSnapshotMeta,
  resolveKonvaYjsIncomingRecord,
  resolveKonvaYjsPublishPlan,
  type PendingRemoteSnapshotMeta,
} from './konvaLocalYjsSyncHelpers'

type UseKonvaLocalYjsSyncOptions = {
  activePageId?: string
  boardId?: string
  canWrite: boolean
  clientInstanceId?: string | null
  document: CanvasDocument
  enabled?: boolean
  getPageEnvelope: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  onRemoteDocumentRestore: (document: KonvaLocalYjsRemoteRestorePayload, meta: KonvaLocalYjsRemoteRestoreMeta) => void
  pageChangedPageIds?: string[]
  pageRevision?: number
  requiresFullBoardSync?: boolean
  roomKey?: string | null
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

const publishDebounceMs = 220

export type KonvaLocalYjsSyncStatus = BoardRealtimeDocumentStatus | 'disabled'
export type KonvaLocalYjsRemoteRestoreMeta = Pick<KonvaYjsRoomRecord, 'activePageId' | 'actorId' | 'changedPageIds' | 'mode' | 'publishedAt' | 'signature'> & {
  basePages: SerializedKonvaBoardPage[] | null
}

export type KonvaLocalYjsRemoteRestorePayload = {
  activePageId?: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  pages: SerializedKonvaBoardPage[]
}

export type KonvaLocalYjsSyncController = {
  applyPendingRemoteSnapshot: () => void
  canRedo: boolean
  canUndo: boolean
  hasPendingRemoteSnapshot: boolean
  hasUnsyncedLocalChanges: boolean
  lastPublishedAt: string | null
  lastRemoteAppliedAt: string | null
  lastRemotePublishedAt: string | null
  pendingRemoteActorId: string | null
  publishLocalSnapshot: () => void
  redoLocalChange: () => void
  status: KonvaLocalYjsSyncStatus
  transportState: BoardRealtimeDocumentState | null
  undoLocalChange: () => void
}

export function useKonvaLocalYjsSync({
  activePageId,
  boardId,
  canWrite,
  clientInstanceId = null,
  document,
  enabled = true,
  getPageEnvelope,
  onRemoteDocumentRestore,
  pageChangedPageIds = [],
  pageRevision = 0,
  requiresFullBoardSync = false,
  roomKey,
  workspace,
  ydoc,
}: UseKonvaLocalYjsSyncOptions) {
  const [syncState, setSyncState] = useState<KonvaLocalYjsSyncController>(() => createLocalYjsSyncState('disabled', null))
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
  const realtimeConnectionRef = useRef<BoardRealtimeDocumentConnection | null>(null)
  const realtimeStatusRef = useRef<KonvaLocalYjsSyncStatus>(resolvedStatus(enabled, roomKey ?? null, boardId))
  const undoManagerRef = useRef<Y.UndoManager | null>(null)

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

  const resolvedRoomKey = enabled
    ? roomKey ?? (boardId && workspace?.id ? `board:${workspace.id}:${boardId}` : null)
    : null

  useEffect(() => {
    realtimeStatusRef.current = resolvedStatus(enabled, resolvedRoomKey, boardId)
    const transportState = resolveTransportState(enabled, resolvedRoomKey, boardId)
    patchSyncState({
      status: realtimeStatusRef.current,
      transportState,
    })
  }, [boardId, enabled, patchSyncState, resolvedRoomKey])

  const cancelScheduledPublish = useCallback(() => {
    if (publishTimerRef.current === null) return
    window.clearTimeout(publishTimerRef.current)
    publishTimerRef.current = null
  }, [])

  const updateRealtimeStatus = useCallback((transportState: BoardRealtimeDocumentState) => {
    const status = transportState.status
    realtimeStatusRef.current = status
    patchSyncState({
      status,
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

  const syncUndoAvailability = useCallback((undoManager: Y.UndoManager | null = undoManagerRef.current) => {
    patchSyncState({
      canRedo: Boolean(undoManager?.canRedo()),
      canUndo: Boolean(undoManager?.canUndo()),
    })
  }, [patchSyncState])

  const rememberSynchronizedRecord = useCallback((record: KonvaYjsRoomRecord) => {
    lastSynchronizedSignatureRef.current = record.signature
    lastSynchronizedPagesRef.current = record.pages
  }, [])

  const readRoomRecordSafely = useCallback(() => {
    return readKonvaYjsRoomRecordSafely(ydoc)
  }, [ydoc])

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
    const decision = resolveKonvaYjsIncomingRecord({
      canWrite: latestCanWriteRef.current,
      currentDocumentSignature: readCurrentDocumentSignature(),
      force: options.force,
      hasUnsyncedLocalChanges: hasUnsyncedLocalChangesRef.current,
      hasSynchronizedPages: lastSynchronizedPagesRef.current !== null,
      lastSynchronizedSignature: lastSynchronizedSignatureRef.current,
      localChangedPageIds: nextChangedPageIdsRef.current,
      localPublishMode: nextPublishModeRef.current,
      record,
      workspaceKind: workspace?.kind,
    })
    if (decision.kind === 'duplicate') {
      rememberSynchronizedRecord(record)
      clearPendingRemoteSnapshot()
      return
    }
    if (decision.kind === 'already-current') {
      rememberSynchronizedRecord(record)
      pendingRemoteSnapshotRef.current = null
      hasUnsyncedLocalChangesRef.current = false
      patchSyncState({
        hasPendingRemoteSnapshot: false,
        hasUnsyncedLocalChanges: false,
        lastRemotePublishedAt: record.publishedAt,
        pendingRemoteActorId: null,
      })
      return
    }
    if (decision.kind === 'republish-local') {
      publishCurrentSnapshotRef.current?.({
        force: true,
        mode: nextPublishModeRef.current,
      })
      return
    }
    if (decision.kind === 'queue-pending') {
      pendingRemoteSnapshotRef.current = decision.pending
      cancelScheduledPublish()
      patchSyncState({
        hasPendingRemoteSnapshot: true,
        lastRemotePublishedAt: record.publishedAt,
        pendingRemoteActorId: record.actorId,
      })
      return
    }
    try {
      const previousPages = lastSynchronizedPagesRef.current
      rememberSynchronizedRecord(record)
      pendingRemoteSnapshotRef.current = null
      hasUnsyncedLocalChangesRef.current = false
      patchSyncState({
        hasPendingRemoteSnapshot: false,
        hasUnsyncedLocalChanges: false,
        lastRemoteAppliedAt: new Date().toISOString(),
        lastRemotePublishedAt: record.publishedAt,
        pendingRemoteActorId: null,
      })
      skipNextPublishRef.current = true
      latestRemoteRestoreRef.current(createRemoteRestorePayload(record), {
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
  }, [cancelScheduledPublish, clearPendingRemoteSnapshot, patchSyncState, readCurrentDocumentSignature, rememberSynchronizedRecord, workspace?.kind])

  const maybeApplyCurrentSnapshot = useCallback(() => {
    const pending = pendingRemoteSnapshotRef.current
    const current = readRoomRecordSafely()
    if (pending && current?.signature === pending.signature) {
      applySnapshotRecord(current)
      return
    }
    pendingRemoteSnapshotRef.current = null
    if (!current) return
    applySnapshotRecord(current)
  }, [applySnapshotRecord, readRoomRecordSafely])

  const publishCurrentSnapshot = useCallback((options: { force?: boolean; mode?: KonvaYjsSnapshotWriteMode } = {}) => {
    const force = options.force ?? false
    const mode = options.mode ?? 'full-board'
    if (!resolvedRoomKey || !latestCanWriteRef.current) {
      maybeApplyCurrentSnapshot()
      return
    }
    if (!initialSyncSettledRef.current) {
      patchSyncState({
        hasUnsyncedLocalChanges: hasUnsyncedLocalChangesRef.current,
        status: realtimeStatusRef.current,
      })
      return
    }
    if (!force && pendingRemoteSnapshotRef.current) {
      patchSyncState({
        hasPendingRemoteSnapshot: true,
        hasUnsyncedLocalChanges: hasUnsyncedLocalChangesRef.current,
      })
      return
    }
    const nextResult = createGuardedKonvaBoardDocument(
      latestDocumentRef.current,
      latestGetPageEnvelopeRef.current(latestDocumentRef.current),
    )
    if (!nextResult.audit.ok) {
      maybeApplyCurrentSnapshot()
      return
    }
    const signature = getDocumentSignature(nextResult.document)
    const publishedAt = new Date().toISOString()
    let didPublish = false
    const wasUninitialized = lastSynchronizedPagesRef.current === null
    if (force || signature !== lastSynchronizedSignatureRef.current) {
      const changedPageIds = mode === 'active-page' && latestActivePageIdRef.current
        ? [latestActivePageIdRef.current]
        : nextChangedPageIdsRef.current
      const synchronizedRecord = writeKonvaYjsSnapshot(ydoc, {
        activePageId: latestActivePageIdRef.current,
        actorId: actorIdRef.current,
        canvasSettings: nextResult.document.canvasSettings,
        changedPageIds,
        mode,
        pages: nextResult.document.pages ?? [],
        publishedAt,
        serializedAt: nextResult.document.serializedAt,
        signature,
      }, localOriginRef.current, {
        activePageId: latestActivePageIdRef.current,
        basePages: lastSynchronizedPagesRef.current,
        changedPageIds,
        mode,
      })
      rememberSynchronizedRecord(synchronizedRecord)
      didPublish = true
      if (wasUninitialized) {
        undoManagerRef.current?.clear()
        syncUndoAvailability()
      }
    }
    pendingRemoteSnapshotRef.current = null
    hasUnsyncedLocalChangesRef.current = false
    patchSyncState({
      hasPendingRemoteSnapshot: false,
      hasUnsyncedLocalChanges: false,
      lastPublishedAt: didPublish ? publishedAt : syncState.lastPublishedAt,
      pendingRemoteActorId: null,
      status: realtimeStatusRef.current,
    })
    maybeApplyCurrentSnapshot()
  }, [maybeApplyCurrentSnapshot, patchSyncState, rememberSynchronizedRecord, resolvedRoomKey, syncState.lastPublishedAt, syncUndoAvailability, ydoc])

  useEffect(() => {
    publishCurrentSnapshotRef.current = publishCurrentSnapshot
    return () => {
      if (publishCurrentSnapshotRef.current === publishCurrentSnapshot) {
        publishCurrentSnapshotRef.current = null
      }
    }
  }, [publishCurrentSnapshot])

  const applyPendingRemoteSnapshot = useCallback(() => {
    cancelScheduledPublish()
    hasUnsyncedLocalChangesRef.current = false
    patchSyncState({ hasUnsyncedLocalChanges: false })
    const pending = pendingRemoteSnapshotRef.current
    const current = readRoomRecordSafely()
    if (!current) {
      clearPendingRemoteSnapshot()
      return
    }
    if (pending && current.signature !== pending.signature) {
      pendingRemoteSnapshotRef.current = createPendingRemoteSnapshotMeta(current)
    }
    applySnapshotRecord(current, { force: true })
  }, [applySnapshotRecord, cancelScheduledPublish, clearPendingRemoteSnapshot, patchSyncState, readRoomRecordSafely])

  const publishLocalSnapshot = useCallback(() => {
    cancelScheduledPublish()
    publishCurrentSnapshot({
      force: true,
      mode: nextPublishModeRef.current,
    })
  }, [cancelScheduledPublish, publishCurrentSnapshot])

  const undoLocalChange = useCallback(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    cancelScheduledPublish()
    hasUnsyncedLocalChangesRef.current = false
    patchSyncState({ hasUnsyncedLocalChanges: false })
    undoManagerRef.current?.undo()
    syncUndoAvailability()
  }, [cancelScheduledPublish, patchSyncState, resolvedRoomKey, syncUndoAvailability])

  const redoLocalChange = useCallback(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    cancelScheduledPublish()
    hasUnsyncedLocalChangesRef.current = false
    patchSyncState({ hasUnsyncedLocalChanges: false })
    undoManagerRef.current?.redo()
    syncUndoAvailability()
  }, [cancelScheduledPublish, patchSyncState, resolvedRoomKey, syncUndoAvailability])

  useEffect(() => {
    const undoManager = createKonvaYjsUndoManager(ydoc, [localOriginRef.current])
    undoManagerRef.current = undoManager
    const updateUndoState = () => {
      syncUndoAvailability(undoManager)
    }
    updateUndoState()
    undoManager.on('stack-cleared', updateUndoState)
    undoManager.on('stack-item-added', updateUndoState)
    undoManager.on('stack-item-popped', updateUndoState)
    undoManager.on('stack-item-updated', updateUndoState)
    return () => {
      undoManager.off('stack-cleared', updateUndoState)
      undoManager.off('stack-item-added', updateUndoState)
      undoManager.off('stack-item-popped', updateUndoState)
      undoManager.off('stack-item-updated', updateUndoState)
      undoManager.destroy()
      if (undoManagerRef.current === undoManager) undoManagerRef.current = null
      syncUndoAvailability(null)
    }
  }, [syncUndoAvailability, ydoc])

  useEffect(() => {
    if (!resolvedRoomKey) {
      cancelScheduledPublish()
      initialSyncSettledRef.current = false
      pendingRemoteSnapshotRef.current = null
      hasUnsyncedLocalChangesRef.current = false
      lastSynchronizedSignatureRef.current = null
      lastSynchronizedPagesRef.current = null
      realtimeConnectionRef.current = null
      syncUndoAvailability(null)
      return
    }
    const connection = connectBoardRealtimeYjsDocument(
      ydoc,
      createBoardRealtimeRoomDescriptor(resolvedRoomKey, { boardId }),
      actorIdRef.current,
      { workspace },
    )
    realtimeConnectionRef.current = connection
    initialSyncSettledRef.current = false
    updateRealtimeStatus(connection.getState())
    const root = ydoc.getMap('konva-board')
    const applyCurrentSnapshotFromYdoc = (transactionOrigin?: unknown) => {
      if (transactionOrigin === localOriginRef.current) return
      const current = readRoomRecordSafely()
      if (!current) return
      applySnapshotRecord(current)
    }
    const handleSnapshotChange = (_events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
      applyCurrentSnapshotFromYdoc(transaction.origin)
    }
    root.observeDeep(handleSnapshotChange)
    const settleInitialRoomState = () => {
      if (initialSyncSettledRef.current) return
      initialSyncSettledRef.current = true
      const current = readRoomRecordSafely()
      if (current) {
        applySnapshotRecord(current)
        return
      }
      if (latestCanWriteRef.current) {
        void publishCurrentSnapshot({
          force: true,
          mode: nextPublishModeRef.current,
        })
      }
    }
    const unsubscribeConnection = connection.subscribe((nextState) => {
      updateRealtimeStatus(nextState)
      if (nextState.initialSyncComplete) {
        settleInitialRoomState()
      }
    })
    applyCurrentSnapshotFromYdoc()
    return () => {
      unsubscribeConnection()
      root.unobserveDeep(handleSnapshotChange)
      initialSyncSettledRef.current = false
      if (realtimeConnectionRef.current === connection) realtimeConnectionRef.current = null
      connection.disconnect()
    }
  }, [applySnapshotRecord, boardId, cancelScheduledPublish, publishCurrentSnapshot, readRoomRecordSafely, resolvedRoomKey, syncUndoAvailability, updateRealtimeStatus, workspace, ydoc])

  useEffect(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    const publishPlan = resolveKonvaYjsPublishPlan({
      activePageId,
      pageChangedPageIds,
      pageRevision,
      previousActivePageId: lastObservedActivePageIdRef.current,
      previousPageRevision: lastObservedPageRevisionRef.current,
      requiresFullBoardSync,
    })
    lastObservedActivePageIdRef.current = activePageId
    lastObservedPageRevisionRef.current = pageRevision
    nextPublishModeRef.current = publishPlan.mode
    nextChangedPageIdsRef.current = publishPlan.changedPageIds
    if (publishPlan.didSwitchPage && !publishPlan.didRevisionChange) {
      cancelScheduledPublish()
      return
    }
    if (skipNextPublishRef.current) {
      skipNextPublishRef.current = false
      cancelScheduledPublish()
      patchSyncState({ hasUnsyncedLocalChanges: false })
      return
    }
    cancelScheduledPublish()
    hasUnsyncedLocalChangesRef.current = true
    patchSyncState({ hasUnsyncedLocalChanges: true })
    publishTimerRef.current = window.setTimeout(() => {
      publishTimerRef.current = null
      publishCurrentSnapshot({ mode: publishPlan.mode })
    }, publishDebounceMs)
    return () => {
      cancelScheduledPublish()
    }
  }, [
    activePageId,
    cancelScheduledPublish,
    document,
    pageChangedPageIds,
    pageRevision,
    requiresFullBoardSync,
    patchSyncState,
    publishCurrentSnapshot,
    resolvedRoomKey,
  ])

  return {
    ...syncState,
    canRedo: canWrite ? syncState.canRedo : false,
    canUndo: canWrite ? syncState.canUndo : false,
    hasPendingRemoteSnapshot: canWrite ? syncState.hasPendingRemoteSnapshot : false,
    hasUnsyncedLocalChanges: canWrite ? syncState.hasUnsyncedLocalChanges : false,
    applyPendingRemoteSnapshot,
    publishLocalSnapshot,
    redoLocalChange,
    status: syncState.status,
    undoLocalChange,
  }
}

function createRemoteRestorePayload(record: KonvaYjsRoomRecord): KonvaLocalYjsRemoteRestorePayload {
  return {
    activePageId: record.activePageId,
    canvasSettings: record.canvasSettings,
    pages: record.pages,
  }
}

function createLocalYjsActorId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `actor_${crypto.randomUUID()}`
  }
  return `actor_${Date.now().toString(36)}`
}

function createLocalYjsSyncState(
  status: KonvaLocalYjsSyncStatus,
  transportState: BoardRealtimeDocumentState | null,
): KonvaLocalYjsSyncController {
  return {
    applyPendingRemoteSnapshot() {},
    canRedo: false,
    canUndo: false,
    hasPendingRemoteSnapshot: false,
    hasUnsyncedLocalChanges: false,
    lastPublishedAt: null,
    lastRemoteAppliedAt: null,
    lastRemotePublishedAt: null,
    pendingRemoteActorId: null,
    publishLocalSnapshot() {},
    redoLocalChange() {},
    status,
    transportState,
    undoLocalChange() {},
  }
}

function resolvedStatus(
  enabled: boolean,
  roomKey: string | null,
  boardId?: string,
): KonvaLocalYjsSyncStatus {
  if (!enabled || !roomKey) return 'disabled'
  if (!hasSupportedBoardRealtimeTransport(boardId)) return 'unsupported'
  return 'connecting'
}

function resolveTransportState(
  enabled: boolean,
  roomKey: string | null,
  boardId?: string,
): BoardRealtimeDocumentState | null {
  if (!enabled || !roomKey) return null
  if (!hasSupportedBoardRealtimeTransport(boardId)) return createUnsupportedBoardRealtimeState()
  return createConnectingBoardRealtimeState()
}
