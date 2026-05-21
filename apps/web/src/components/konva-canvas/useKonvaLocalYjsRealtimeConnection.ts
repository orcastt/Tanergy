'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import * as Y from 'yjs'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type BoardRealtimeDocumentConnection,
  type BoardRealtimeDocumentState,
  connectBoardRealtimeYjsDocument,
  createBoardRealtimeRoomDescriptor,
} from '@/features/collaboration/boardRealtimeTransport'
import {
  createKonvaYjsUndoManager,
  type KonvaYjsRoomRecord,
  type KonvaYjsSnapshotWriteMode,
} from '@/features/collaboration/konvaYjsSnapshot'
import type { PendingRemoteSnapshotMeta } from './konvaLocalYjsSyncHelpers'

type UseKonvaLocalYjsRealtimeConnectionOptions = {
  actorIdRef: MutableRefObject<string>
  applySnapshotRecord: (record: KonvaYjsRoomRecord, options?: { force?: boolean }) => void
  boardId?: string
  cancelScheduledPublish: () => void
  hasUnsyncedLocalChangesRef: MutableRefObject<boolean>
  initialSyncSettledRef: MutableRefObject<boolean>
  lastSynchronizedPagesRef: MutableRefObject<KonvaYjsRoomRecord['pages'] | null>
  lastSynchronizedSignatureRef: MutableRefObject<string | null>
  latestCanWriteRef: MutableRefObject<boolean>
  localOriginRef: MutableRefObject<symbol>
  nextPublishModeRef: MutableRefObject<KonvaYjsSnapshotWriteMode>
  pendingRemoteSnapshotRef: MutableRefObject<PendingRemoteSnapshotMeta | null>
  publishCurrentSnapshot: (options?: { force?: boolean; mode?: KonvaYjsSnapshotWriteMode }) => void
  readRoomRecordSafely: () => KonvaYjsRoomRecord | null
  resolvedRoomKey: string | null
  syncUndoAvailability: (undoManager?: Y.UndoManager | null) => void
  undoManagerRef: MutableRefObject<Y.UndoManager | null>
  updateRealtimeStatus: (transportState: BoardRealtimeDocumentState) => void
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

export function useKonvaLocalYjsRealtimeConnection({
  actorIdRef,
  applySnapshotRecord,
  boardId,
  cancelScheduledPublish,
  hasUnsyncedLocalChangesRef,
  initialSyncSettledRef,
  lastSynchronizedPagesRef,
  lastSynchronizedSignatureRef,
  latestCanWriteRef,
  localOriginRef,
  nextPublishModeRef,
  pendingRemoteSnapshotRef,
  publishCurrentSnapshot,
  readRoomRecordSafely,
  resolvedRoomKey,
  syncUndoAvailability,
  undoManagerRef,
  updateRealtimeStatus,
  workspace,
  ydoc,
}: UseKonvaLocalYjsRealtimeConnectionOptions) {
  const realtimeConnectionRef = useRef<BoardRealtimeDocumentConnection | null>(null)

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
  }, [localOriginRef, syncUndoAvailability, undoManagerRef, ydoc])

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
      if (current) applySnapshotRecord(current)
    }
    const handleSnapshotChange = (_events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
      applyCurrentSnapshotFromYdoc(transaction.origin)
    }
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
    root.observeDeep(handleSnapshotChange)
    const unsubscribeConnection = connection.subscribe((nextState) => {
      updateRealtimeStatus(nextState)
      if (nextState.initialSyncComplete) settleInitialRoomState()
    })
    applyCurrentSnapshotFromYdoc()
    return () => {
      unsubscribeConnection()
      root.unobserveDeep(handleSnapshotChange)
      initialSyncSettledRef.current = false
      if (realtimeConnectionRef.current === connection) realtimeConnectionRef.current = null
      connection.disconnect()
    }
  }, [
    actorIdRef,
    applySnapshotRecord,
    boardId,
    cancelScheduledPublish,
    hasUnsyncedLocalChangesRef,
    initialSyncSettledRef,
    lastSynchronizedPagesRef,
    lastSynchronizedSignatureRef,
    latestCanWriteRef,
    localOriginRef,
    nextPublishModeRef,
    pendingRemoteSnapshotRef,
    publishCurrentSnapshot,
    readRoomRecordSafely,
    resolvedRoomKey,
    syncUndoAvailability,
    updateRealtimeStatus,
    workspace,
    ydoc,
  ])
}
