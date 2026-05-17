'use client'

import { useEffect } from 'react'
import * as Y from 'yjs'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { KonvaBoardDocumentSerializationOptions } from '@/features/boards/konvaBoardDocument'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  resolveLocalYjsSyncStatus,
  resolveLocalYjsTransportState,
  type KonvaLocalYjsRemoteRestoreMeta,
  type KonvaLocalYjsRemoteRestorePayload,
  type KonvaLocalYjsSyncController,
} from './konvaLocalYjsSyncContract'
import { useKonvaLocalYjsRealtimeConnection } from './useKonvaLocalYjsRealtimeConnection'
import { useKonvaLocalYjsSnapshotController } from './useKonvaLocalYjsSnapshotController'

export type {
  KonvaLocalYjsRemoteRestoreMeta,
  KonvaLocalYjsRemoteRestorePayload,
  KonvaLocalYjsSyncController,
  KonvaLocalYjsSyncStatus,
} from './konvaLocalYjsSyncContract'

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
}: UseKonvaLocalYjsSyncOptions): KonvaLocalYjsSyncController {
  const resolvedRoomKey = enabled
    ? roomKey ?? (boardId && workspace?.id ? `board:${workspace.id}:${boardId}` : null)
    : null
  const initialStatus = resolveLocalYjsSyncStatus(enabled, resolvedRoomKey, boardId)
  const controller = useKonvaLocalYjsSnapshotController({
    activePageId,
    canWrite,
    clientInstanceId,
    document,
    getPageEnvelope,
    initialStatus,
    onRemoteDocumentRestore,
    pageChangedPageIds,
    pageRevision,
    requiresFullBoardSync,
    resolvedRoomKey,
    workspace,
    ydoc,
  })
  const {
    actorIdRef,
    applyPendingRemoteSnapshot,
    applySnapshotRecord,
    cancelScheduledPublish,
    hasUnsyncedLocalChangesRef,
    initialSyncSettledRef,
    lastSynchronizedPagesRef,
    lastSynchronizedSignatureRef,
    latestCanWriteRef,
    localOriginRef,
    nextPublishModeRef,
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
  } = controller

  useEffect(() => {
    realtimeStatusRef.current = resolveLocalYjsSyncStatus(enabled, resolvedRoomKey, boardId)
    patchSyncState({
      status: realtimeStatusRef.current,
      transportState: resolveLocalYjsTransportState(enabled, resolvedRoomKey, boardId),
    })
  }, [boardId, enabled, patchSyncState, realtimeStatusRef, resolvedRoomKey])

  useKonvaLocalYjsRealtimeConnection({
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
  })

  return {
    ...syncState,
    applyPendingRemoteSnapshot,
    canRedo: canWrite ? syncState.canRedo : false,
    canUndo: canWrite ? syncState.canUndo : false,
    hasPendingRemoteSnapshot: canWrite ? syncState.hasPendingRemoteSnapshot : false,
    hasUnsyncedLocalChanges: canWrite ? syncState.hasUnsyncedLocalChanges : false,
    publishLocalSnapshot,
    redoLocalChange,
    status: syncState.status,
    undoLocalChange,
  }
}
