'use client'

import { useEffect, useMemo, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as Y from 'yjs'
import type { CanvasBounds, CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import { createRemoteEditingOwnerMap } from './konvaCanvasSpikeHelpers'
import { createRemoteShapeLockOwnerMap } from './konvaCollaborationLocks'
import {
  createCollaborationPageSummaries,
  createRemoteEdgeSessions,
  resolveKonvaCollaborationMode,
} from './konvaCanvasBoardCollaborationDerived'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { useBoardCollaborationPresence } from './useBoardCollaborationPresence'
import { useKonvaCanvasBoardSync } from './useKonvaCanvasBoardSync'
import { useKonvaCanvasHistory, type KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import { useKonvaFocusedEditOccupancy } from './useKonvaFocusedEditOccupancy'
import { useKonvaPendingImagePastes } from './useKonvaPendingImagePastes'
import { useKonvaBoardPages } from './useKonvaBoardPages'

type UseKonvaCanvasBoardCollaborationBridgeOptions = {
  activeToolPreference: KonvaCanvasTool
  boardId: string
  boardPageHistoryRef: MutableRefObject<{
    getPageState?: (document: CanvasDocument) => KonvaCanvasHistoryPageState | null
    restorePageState?: (state: KonvaCanvasHistoryPageState) => void
  }>
  boardPages: ReturnType<typeof useKonvaBoardPages>
  clearTransientState: () => void
  connectionPreviewPresence: BoardCollaborationConnectionPreview | null
  cropEditingImageId: string | null
  document: CanvasDocument
  editingNodeText: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingTextId: string | null
  handleSelectionChange: (shapeIds: string[]) => void
  hasPersistedBoard: boolean
  history: ReturnType<typeof useKonvaCanvasHistory>
  initialBoard: BoardPersistenceRecord | null
  interactionShapeIds: string[]
  interactionLockedRef: MutableRefObject<boolean>
  mode: 'board' | 'dev'
  onBoardLoaded?: (title: string) => void
  readOnly: boolean
  saveAuditRef: RefObject<KonvaBoardSaveAuditHandle | null>
  selectedEdgeId: string | null
  selectionMarqueeBounds: CanvasBounds | null
  setCropEditingImageId: Dispatch<SetStateAction<string | null>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  transformPreview: { bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

export function useKonvaCanvasBoardCollaborationBridge({
  activeToolPreference,
  boardId,
  boardPageHistoryRef,
  boardPages,
  clearTransientState,
  connectionPreviewPresence,
  cropEditingImageId,
  document,
  editingNodeText,
  editingTextId,
  handleSelectionChange,
  hasPersistedBoard,
  history,
  initialBoard,
  interactionShapeIds,
  interactionLockedRef,
  mode,
  onBoardLoaded,
  readOnly,
  saveAuditRef,
  selectedEdgeId,
  selectionMarqueeBounds,
  setCropEditingImageId,
  setSelectedEdgeId,
  setSettingsOpen,
  transformPreview,
  workspace,
  ydoc,
}: UseKonvaCanvasBoardCollaborationBridgeOptions) {
  const collaborationPageSummaries = useMemo(
    () => createCollaborationPageSummaries(boardPages.pages),
    [boardPages.pages],
  )

  const collaborationEnabled = mode === 'board'
    && hasPersistedBoard
    && Boolean(workspace?.id)
    && (!initialBoard || workspace?.id === initialBoard.workspaceId)

  const collaboration = useBoardCollaborationPresence({
    activePageId: boardPages.activePageId,
    boardId: mode === 'board' ? boardId : undefined,
    connectionPreview: readOnly ? null : connectionPreviewPresence,
    enabled: collaborationEnabled,
    selectedEdgeId: readOnly ? null : selectedEdgeId,
    selectionBox: readOnly ? null : selectionMarqueeBounds,
    selectedIds: readOnly ? [] : interactionShapeIds,
    tool: activeToolPreference,
    transformBox: readOnly ? null : transformPreview?.bounds ?? null,
    transformKind: readOnly ? null : transformPreview?.kind ?? null,
    workspace,
  })

  const remoteEdgeSessions = useMemo(
    () => createRemoteEdgeSessions(collaboration.activeSessions, boardPages.activePageId),
    [boardPages.activePageId, collaboration.activeSessions],
  )

  const remoteEditingOwners = useMemo(
    () => createRemoteEditingOwnerMap(collaboration.shapeOccupancy),
    [collaboration.shapeOccupancy],
  )
  const remoteShapeLockOwners = useMemo(
    () => createRemoteShapeLockOwnerMap(collaboration.shapeOccupancy, boardPages.activePageId),
    [boardPages.activePageId, collaboration.shapeOccupancy],
  )
  const { activeTool, effectiveReadOnly, stageToolMode } = resolveKonvaCollaborationMode({
    activeToolPreference,
    canEdit: collaboration.canEdit,
    readOnly,
    status: collaboration.status,
  })

  useEffect(() => {
    interactionLockedRef.current = effectiveReadOnly
  }, [effectiveReadOnly, interactionLockedRef])

  const { handlePendingImagePasteComplete, handlePendingImagePasteStateChange, visiblePendingImagePastes } = useKonvaPendingImagePastes({
    activePageId: boardPages.activePageId,
  })

  const { localYjsSync, markBoardSavedAt } = useKonvaCanvasBoardSync({
    boardId,
    boardPageHistoryRef,
    boardPages,
    clearTransientState,
    collaborationBoardSavedAt: collaboration.boardSavedAt ?? null,
    collaborationClientInstanceId: collaboration.clientInstanceId,
    collaborationEnabled,
    collaborationRoomKey: collaboration.roomKey,
    document,
    effectiveReadOnly,
    history,
    initialBoard,
    mode,
    onBoardLoaded,
    saveAuditRef,
    setSettingsOpen,
    workspace,
    ydoc,
  })

  const {
    editingPresenceShapeIds,
    focusedEditNotice,
    requestFocusedEditShape,
    setFocusedControlShapeState,
  } = useKonvaFocusedEditOccupancy({
    cropEditingImageId,
    editingNodeText,
    editingTextId,
    onSelectionChange: handleSelectionChange,
    remoteEditingOwners,
    setCropEditingImageId,
    setSelectedEdgeId,
  })

  useEffect(() => {
    collaboration.setEditingShapeIds(editingPresenceShapeIds)
  }, [collaboration, editingPresenceShapeIds])

  return {
    activeTool,
    collaboration,
    collaborationEnabled,
    collaborationPageSummaries,
    effectiveReadOnly,
    focusedEditNotice,
    handlePendingImagePasteComplete,
    handlePendingImagePasteStateChange,
    localYjsSync,
    markBoardSavedAt,
    remoteEdgeSessions,
    remoteShapeLockOwners,
    requestFocusedEditShape,
    setFocusedControlShapeState,
    stageToolMode,
    visiblePendingImagePastes,
  }
}
