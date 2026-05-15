'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import * as Y from 'yjs'
import { createEmptyCanvasDocument, screenToWorld, type CanvasCamera, type CanvasDocument, type CanvasNodeShape, type CanvasPoint, type CanvasShape, type CanvasShapeStyle } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { loadLocalBoardDocument } from '@/features/boards/localBoardClient'
import { defaultCanvasSettings, useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { defaultKonvaBoardPageId } from '@/features/boards/konvaBoardPageContract'
import {
  restoreKonvaBoardDocument,
  restoreKonvaBoardPages,
} from '@/features/boards/konvaBoardDocument'
import { CanvasSettingsPanel } from '@/components/canvas/CanvasSettingsPanel'
import { CanvasTooltipLayer } from '@/components/canvas/CanvasTooltipLayer'
import { KonvaCanvasHeader } from './KonvaCanvasHeader'
import { KonvaBoardSaveAudit, type KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import { KonvaCollaborationOverlay } from './KonvaCollaborationOverlay'
import { KonvaCanvasDiagnostics } from './KonvaCanvasDiagnostics'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import { KonvaContextMenuHost } from './KonvaContextMenuHost'
import { KonvaLocalSyncBanner } from './KonvaLocalSyncBanner'
import { KonvaCanvasNavigator } from './KonvaCanvasNavigator'
import { KonvaCanvasPagesPanel } from './KonvaCanvasPagesPanel'
import { KonvaCanvasProperties } from './KonvaCanvasProperties'
import { KonvaCanvasStage } from './KonvaCanvasStage'
import { KonvaCanvasViewerStage } from './KonvaCanvasViewerStage'
import { isKonvaEditableTextShape, KonvaTextEditor, type KonvaEditableTextShape } from './KonvaTextEditor'
import { getEditableKonvaNodeTextField, KonvaNodeTextEditor, type KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { KonvaCanvasToolbar } from './KonvaCanvasToolbar'
import { KonvaNodeCreateMenu } from './KonvaNodeCreateMenu'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'
import { isKonvaCreateTool, type KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaDefaultShapeStyle } from './konvaCanvasStyle'
import { runKonvaContextAction } from './konvaContextActions'
import { canCropKonvaImageSelection, getCropImageIdForSelection } from './konvaImageCropCommands'
import { createSeedShapes } from './konvaSeedShapes'
import { KonvaSelectionToolbar } from './KonvaSelectionToolbar'
import { updateTextShape } from './konvaShapeCommands'
import { useKonvaBrowserSelectionGuard } from './useKonvaBrowserSelectionGuard'
import { useKonvaBoardPages } from './useKonvaBoardPages'
import { useKonvaCanvasControls } from './useKonvaCanvasControls'
import { useKonvaCanvasHistory, type KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import { useKonvaCanvasMetrics } from './useKonvaCanvasMetrics'
import { useKonvaCanvasShortcuts } from './useKonvaCanvasShortcuts'
import { useKonvaImageOpsActions } from './useKonvaImageOpsActions'
import { useKonvaImageNodeActions } from './useKonvaImageNodeActions'
import { canReplaceImageNode, useKonvaImageNodeUpload } from './useKonvaImageNodeUpload'
import { useKonvaNodeCreationMenu } from './useKonvaNodeCreationMenu'
import { useKonvaSelectionExportActions } from './useKonvaSelectionExportActions'
import { useKonvaStageDomEvents } from './useKonvaStageDomEvents'
import { removeKonvaRuntimeEdge } from './konvaRuntimeEdges'
import { useBoardCollaborationPresence } from './useBoardCollaborationPresence'
import {
  useKonvaLocalYjsSync,
  type KonvaLocalYjsRemoteRestorePayload,
} from './useKonvaLocalYjsSync'

type KonvaCanvasSpikeProps = {
  autoLoadBoard?: boolean
  boardId?: string
  boardTitle?: string
  initialBoard?: BoardPersistenceRecord | null
  mode?: 'board' | 'dev'
  onBoardLoaded?: (title: string) => void
  onBoardSaved?: (board: BoardPersistenceSummary) => void
  onBoardTitleRename?: (title: string) => Promise<string | void> | string | void
  readOnly?: boolean
  seedOnMount?: boolean
  workspace?: TangentWorkspace
}

export function KonvaCanvasSpike({
  autoLoadBoard = false,
  boardId = 'konva-spike-local',
  boardTitle = 'Konva Spike Local',
  initialBoard = null,
  mode = 'dev',
  onBoardLoaded,
  onBoardSaved,
  onBoardTitleRename,
  readOnly = false,
  seedOnMount = true,
  workspace,
}: KonvaCanvasSpikeProps = {}) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const ydoc = useMemo(() => new Y.Doc({
    guid: `konva:${workspace?.id ?? 'local'}:${boardId}`,
  }), [boardId, workspace?.id])
  const [document, setDocument] = useState<CanvasDocument>(() => createInitialDocument({
    boardTitle,
    initialBoard,
    seedOnMount,
    workspaceId: initialBoard?.workspaceId ?? workspace?.id,
  }))
  const [camera, setCamera] = useState<CanvasCamera>(document.camera)
  const [activeToolState, setActiveToolState] = useState<KonvaCanvasTool>('select')
  const activeToolPreference = readOnly ? 'hand' : activeToolState
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const [nextStyle, setNextStyle] = useState<CanvasShapeStyle>(konvaDefaultShapeStyle)
  const [pendingImagePastes, setPendingImagePastes] = useState<KonvaPendingImagePaste[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [cropEditingImageId, setCropEditingImageId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingNodeText, setEditingNodeText] = useState<{ fieldName: KonvaNodeTextFieldName; shapeId: string } | null>(null)
  const [selectionActionError, setSelectionActionError] = useState<string | null>(null)
  const [dropHintKind, setDropHintKind] = useState<'image' | 'pdf' | null>(null)
  const [stage, setStage] = useState<Konva.Stage | null>(null)
  const [contextMenu, setContextMenu] = useState<{ worldX: number; worldY: number; x: number; y: number } | null>(null)
  const [persistedBoardIds, setPersistedBoardIds] = useState<Record<string, true>>(() => (
    initialBoard ? { [boardId]: true } : {}
  ))
  const hasPersistedBoard = Boolean(initialBoard) || Boolean(persistedBoardIds[boardId])
  const themeMode = useResolvedCanvasThemeMode()
  const [, setClipboardShapeCount] = useState(0)
  const clipboardRef = useRef<CanvasShape[]>([])
  const interactionLockedRef = useRef(readOnly)
  const saveAuditRef = useRef<KonvaBoardSaveAuditHandle | null>(null)
  const lastKnownBoardSavedAtRef = useRef<string | null>(initialBoard?.savedAt ?? null)
  const remoteSyncInFlightRef = useRef(false)
  const requestedRemoteBoardSavedAtRef = useRef<string | null>(null)
  const wasReadOnlyRef = useRef(false)
  const lastPastePointRef = useRef<CanvasPoint | null>(null)
  const restoredInitialBoardId = useRef<string | null>(null)
  const pendingImagePasteTimeoutsRef = useRef(new Map<string, number>())
  const activePageIdRef = useRef(defaultKonvaBoardPageId)
  const boardPageHistoryRef = useRef<{
    getPageState?: (document: CanvasDocument) => KonvaCanvasHistoryPageState | null
    restorePageState?: (state: KonvaCanvasHistoryPageState) => void
  }>({})
  const handleSelectionChange = useCallback((shapeIds: string[]) => {
    setSelectedIds(shapeIds)
    setSelectionActionError(null)
    if (shapeIds.length > 0) setSelectedEdgeId(null)
    setCropEditingImageId((current) => (shapeIds.length === 1 && shapeIds[0] === current ? current : null))
  }, [])
  const handleToolChange = useCallback((tool: KonvaCanvasTool) => {
    if (interactionLockedRef.current) return
    setActiveToolState(tool)
  }, [])
  useKonvaBrowserSelectionGuard(shellRef)
  const { diagnostics, setShellRect, shellRect, size } = useKonvaCanvasMetrics({
    document,
    shellRef,
  })
  const history = useKonvaCanvasHistory({
    document,
    getPageState: (snapshotDocument) => boardPageHistoryRef.current.getPageState?.(snapshotDocument) ?? null,
    onDocumentChange: setDocument,
    onPageStateRestore: (state) => boardPageHistoryRef.current.restorePageState?.(state),
    onSelectionChange: handleSelectionChange,
    selectedIds,
  })
  const { cleanChatHistory, closeNodeMenu, createNodeCard, nodeMenu, openNodeMenu, sendChatMessage, setChatModel, setNodeField, setNodeTextField, toggleChatMessageExport, toggleNodeRun } = useKonvaNodeCreationMenu({
    boardId,
    camera,
    document,
    history,
    lastPastePointRef,
    onDocumentChange: setDocument,
    onEdgeSelectionChange: setSelectedEdgeId,
    onSelectionChange: handleSelectionChange,
    onToolChange: handleToolChange,
    size,
    workspace,
  })
  const clearTransientState = useCallback(() => {
    handleSelectionChange([])
    setSelectedEdgeId(null)
    setCropEditingImageId(null)
    setEditingTextId(null)
    setEditingNodeText(null)
    setContextMenu(null)
    closeNodeMenu()
  }, [closeNodeMenu, handleSelectionChange])
  const boardPages = useKonvaBoardPages({
    activeDocument: document,
    camera,
    onCameraChange: setCamera,
    onDocumentChange: setDocument,
    onTransientClear: clearTransientState,
  })
  useEffect(() => {
    activePageIdRef.current = boardPages.activePageId
  }, [boardPages.activePageId])
  const collaborationEnabled = mode === 'board'
    && hasPersistedBoard
    && Boolean(workspace?.id)
    && (!initialBoard || workspace?.id === initialBoard.workspaceId)
  const collaboration = useBoardCollaborationPresence({
    activePageId: boardPages.activePageId,
    boardId: mode === 'board' ? boardId : undefined,
    enabled: collaborationEnabled,
    selectedIds,
    tool: activeToolPreference,
    workspace,
  })
  const setCollaborationEditingShapeIds = collaboration.setEditingShapeIds
  const remoteEditingOwners = useMemo(() => createRemoteEditingOwnerMap(collaboration.shapeOccupancy), [collaboration.shapeOccupancy])
  const effectiveReadOnly = readOnly || (collaboration.status === 'ready' && !collaboration.canEdit)
  const activeTool = effectiveReadOnly ? 'hand' : activeToolState
  const stageToolMode = effectiveReadOnly ? 'view' : isKonvaCreateTool(activeTool) ? 'create' : activeTool
  const restoreBoardRecord = useCallback((
    board: BoardPersistenceRecord,
    options: { clearTransient?: boolean } = {},
  ) => {
    const restored = restoreKonvaBoardDocument(board.document, { workspaceId: board.workspaceId })
    if (options.clearTransient ?? true) clearTransientState()
    history.clear()
    boardPages.restorePages(restored)
    restoredInitialBoardId.current = board.id
    lastKnownBoardSavedAtRef.current = board.savedAt
    onBoardLoaded?.(board.title)
  }, [boardPages, clearTransientState, history, onBoardLoaded])
  const restoreCollaborativeDocument = useCallback((
    remoteDocument: KonvaLocalYjsRemoteRestorePayload,
    options: {
      basePages?: NonNullable<KonvaLocalYjsRemoteRestorePayload['pages']>
      changedPageIds?: readonly string[]
      clearTransient?: boolean
      mode?: 'active-page' | 'page-batch' | 'full-board'
    } = {},
  ) => {
    useCanvasSettingsStore.getState().replace(remoteDocument.canvasSettings ?? defaultCanvasSettings)
    const remotePages = remoteDocument.pages
    const remoteActivePageId = remoteDocument.activePageId
    const basePages = options.basePages ? [...options.basePages] : undefined
    const applied = boardPages.applyRemotePageChanges(remotePages, {
      basePages,
      changedPageIds: options.changedPageIds,
      preserveCamera: true,
      remoteActivePageId: typeof remoteActivePageId === 'string' ? remoteActivePageId : undefined,
    })
    if (applied.applied) {
      if (applied.activePageChanged) {
        history.clear()
      }
      return
    }
    const restore = restoreKonvaBoardPages({
      activePageId: remoteActivePageId,
      pages: remotePages,
    })
    if (options.clearTransient ?? true) clearTransientState()
    history.clear()
    boardPages.restorePages(restore, {
      bumpCollaborationRevision: false,
      preserveActivePage: true,
      preserveCamera: true,
    })
  }, [boardPages, clearTransientState, history])
  useEffect(() => {
    interactionLockedRef.current = effectiveReadOnly
  }, [effectiveReadOnly])
  useEffect(() => () => {
    for (const timeoutId of pendingImagePasteTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId)
    }
    pendingImagePasteTimeoutsRef.current.clear()
    ydoc.destroy()
  }, [ydoc])
  useEffect(() => {
    boardPageHistoryRef.current.getPageState = boardPages.getHistoryState
    boardPageHistoryRef.current.restorePageState = boardPages.restoreHistoryState
  }, [boardPages.getHistoryState, boardPages.restoreHistoryState])
  useEffect(() => {
    if (effectiveReadOnly && !wasReadOnlyRef.current) {
      const timeoutId = window.setTimeout(() => {
        clearTransientState()
        setSettingsOpen(false)
      }, 0)
      wasReadOnlyRef.current = true
      return () => window.clearTimeout(timeoutId)
    }
    wasReadOnlyRef.current = effectiveReadOnly
  }, [clearTransientState, effectiveReadOnly])
  useEffect(() => {
    if (!initialBoard || restoredInitialBoardId.current === initialBoard.id) return
    const timeoutId = window.setTimeout(() => {
      try {
        restoreBoardRecord(initialBoard, { clearTransient: false })
      } catch {
        restoredInitialBoardId.current = initialBoard.id
        lastKnownBoardSavedAtRef.current = initialBoard.savedAt
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [initialBoard, restoreBoardRecord])
  useEffect(() => {
    const remoteBoardSavedAt = collaboration.boardSavedAt
    if (!collaborationEnabled || !boardId || !workspace || !effectiveReadOnly || !remoteBoardSavedAt) return
    if (!isBoardSavedAtNewer(remoteBoardSavedAt, lastKnownBoardSavedAtRef.current)) return
    if (remoteSyncInFlightRef.current || requestedRemoteBoardSavedAtRef.current === remoteBoardSavedAt) return
    requestedRemoteBoardSavedAtRef.current = remoteBoardSavedAt
    remoteSyncInFlightRef.current = true
    void loadLocalBoardDocument(boardId, workspace, { force: true })
      .then((response) => {
        if (!response.board || !isBoardSavedAtNewer(response.board.savedAt, lastKnownBoardSavedAtRef.current)) return
        restoreBoardRecord(response.board)
      })
      .catch(() => {
        requestedRemoteBoardSavedAtRef.current = null
      })
      .finally(() => {
        remoteSyncInFlightRef.current = false
      })
  }, [boardId, collaboration.boardSavedAt, collaborationEnabled, effectiveReadOnly, restoreBoardRecord, workspace])
  const localYjsSync = useKonvaLocalYjsSync({
    activePageId: boardPages.activePageId,
    boardId: mode === 'board' ? boardId : undefined,
    canWrite: collaborationEnabled && !effectiveReadOnly,
    clientInstanceId: collaboration.clientInstanceId,
    document,
    enabled: collaborationEnabled,
    getPageEnvelope: boardPages.getPageEnvelope,
    onRemoteDocumentRestore: (restore, meta) => {
      saveAuditRef.current?.acknowledgeExternalDocument(meta.signature)
      restoreCollaborativeDocument(restore, {
        basePages: meta.basePages ?? undefined,
        changedPageIds: meta.changedPageIds,
        mode: meta.mode,
      })
    },
    pageChangedPageIds: boardPages.collaborationChange.changedPageIds,
    pageRevision: boardPages.collaborationRevision,
    requiresFullBoardSync: boardPages.collaborationChange.requiresFullBoardSync,
    roomKey: collaboration.roomKey,
    workspace,
    ydoc,
  })
  const editingPresenceShapeIds = useMemo(() => dedupeEditingPresenceShapeIds([
    cropEditingImageId,
    editingNodeText?.shapeId,
    editingTextId,
  ]), [cropEditingImageId, editingNodeText?.shapeId, editingTextId])
  useEffect(() => {
    setCollaborationEditingShapeIds(editingPresenceShapeIds)
  }, [editingPresenceShapeIds, setCollaborationEditingShapeIds])
  const { fileInput, promptImageNodeUpload, uploadDropFileAtPoint } = useKonvaImageNodeUpload({
    document,
    history,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    workspace,
  })
  const stageDomEvents = useKonvaStageDomEvents({
    camera,
    document,
    lastPastePointRef,
    nodeMenuOpen: Boolean(nodeMenu),
    onCanvasDoubleClick: openNodeMenu,
    onContextMenuChange: setContextMenu,
    onDropHintChange: setDropHintKind,
    onHoveredShapeIdChange: collaboration.setHoveredShapeId,
    onNodeMenuClose: closeNodeMenu,
    onPointerWorldChange: collaboration.setCursor,
    onSelectionChange: handleSelectionChange,
    onShellRectChange: setShellRect,
    onToolChange: handleToolChange,
    onUploadDropFileAtPoint: uploadDropFileAtPoint,
    selectedIds,
  })

  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])
  const selectedShapes = useMemo(() => {
    const selected = new Set(selectedIds)
    return document.shapes.filter((shape) => selected.has(shape.id))
  }, [document.shapes, selectedIds])
  const canLockSelection = selectedShapes.some((shape) => !shape.isLocked)
  const canUnlockSelection = selectedShapes.some((shape) => shape.isLocked)
  const { canConvertImageToNode, convertImageToNode, sendImageNodeToCanvas } = useKonvaImageNodeActions({
    document,
    history,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
    workspace,
  })
  const imageOps = useKonvaImageOpsActions({
    document,
    history,
    onActionError: setSelectionActionError,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
    workspace,
  })
  const { addStressStrokes, clearCanvas, handleCameraCommit, handleCameraPreview, resetZoom, zoomAtCenter } = useKonvaCanvasControls({
    camera,
    history,
    onCameraChange: setCamera,
    onDocumentChange: setDocument,
    onEdgeSelectionChange: setSelectedEdgeId,
    onSelectionChange: handleSelectionChange,
    size,
  })
  const canCropImage = canCropKonvaImageSelection(document, selectedIds)
  const cropImage = useCallback(() => {
    const imageId = getCropImageIdForSelection(document, selectedIds)
    if (!imageId) return
    const editingOwner = remoteEditingOwners.get(imageId)
    if (editingOwner) {
      setSelectionActionError(`${editingOwner} is already editing this item.`)
      return
    }
    handleToolChange('select')
    setCropEditingImageId((current) => (current === imageId ? null : imageId))
  }, [document, handleToolChange, remoteEditingOwners, selectedIds])
  const handleCreatePage = useCallback(() => {
    history.checkpoint(document)
    boardPages.createPage()
  }, [boardPages, document, history])
  const handleDeletePage = useCallback((pageId: string) => {
    history.checkpoint(document)
    boardPages.deletePage(pageId)
  }, [boardPages, document, history])
  const handleDuplicatePage = useCallback((pageId: string) => {
    history.checkpoint(document)
    boardPages.duplicatePage(pageId)
  }, [boardPages, document, history])
  const handleMovePage = useCallback((pageId: string, direction: Parameters<typeof boardPages.movePage>[1]) => {
    history.checkpoint(document)
    boardPages.movePage(pageId, direction)
  }, [boardPages, document, history])
  const handleRenamePage = useCallback((pageId: string, title: string) => {
    const nextTitle = title.trim()
    const currentTitle = boardPages.pages.find((page) => page.id === pageId)?.title.trim()
    if (!nextTitle || nextTitle === currentTitle) return
    history.checkpoint(document)
    boardPages.renamePage(pageId, nextTitle)
  }, [boardPages, document, history])
  const handleMoveSelectionToPage = useCallback((targetPageId: string) => {
    history.checkpoint(document)
    boardPages.moveSelectionToPage(targetPageId, selectedIds)
  }, [boardPages, document, history, selectedIds])
  const clearPendingImagePasteTimeout = useCallback((pendingId: string) => {
    const timeoutId = pendingImagePasteTimeoutsRef.current.get(pendingId)
    if (timeoutId === undefined) return
    window.clearTimeout(timeoutId)
    pendingImagePasteTimeoutsRef.current.delete(pendingId)
  }, [])
  const handlePendingImagePasteStateChange = useCallback((state: KonvaPendingImagePaste) => {
    clearPendingImagePasteTimeout(state.id)
    setPendingImagePastes((current) => {
      const next = current.filter((item) => item.id !== state.id)
      next.push(state)
      return next
    })
    if (state.status !== 'failed') return
    const timeoutId = window.setTimeout(() => {
      pendingImagePasteTimeoutsRef.current.delete(state.id)
      setPendingImagePastes((current) => current.filter((item) => item.id !== state.id))
    }, 1800)
    pendingImagePasteTimeoutsRef.current.set(state.id, timeoutId)
  }, [clearPendingImagePasteTimeout])
  const handlePendingImagePasteComplete = useCallback((pendingId: string) => {
    clearPendingImagePasteTimeout(pendingId)
    setPendingImagePastes((current) => current.filter((item) => item.id !== pendingId))
  }, [clearPendingImagePasteTimeout])
  const visiblePendingImagePastes = useMemo(() => (
    pendingImagePastes.filter((item) => item.pageId === boardPages.activePageId)
  ), [boardPages.activePageId, pendingImagePastes])

  const editingTextShape = document.shapes.find((shape): shape is KonvaEditableTextShape => shape.id === editingTextId && isKonvaEditableTextShape(shape))
  const editingNodeTextShape = editingNodeText
    ? document.shapes.find((shape): shape is CanvasNodeShape => shape.id === editingNodeText.shapeId && shape.type === 'node_card')
    : null
  const selectionExport = useKonvaSelectionExportActions({
    document,
    history,
    onActionError: setSelectionActionError,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
    workspace,
  })
  const handleSelectionExportStageReady = selectionExport.handleStageReady
  const {
    canRedo: canCollaborativeRedo,
    canUndo: canCollaborativeUndo,
    hasUnsyncedLocalChanges: hasUnsyncedCollaborativeChanges,
    redoLocalChange,
    undoLocalChange,
  } = localYjsSync
  const handleUndoShortcut = useCallback(() => {
    if (hasUnsyncedCollaborativeChanges || !canCollaborativeUndo) {
      history.undo()
      return
    }
    undoLocalChange()
  }, [canCollaborativeUndo, hasUnsyncedCollaborativeChanges, history, undoLocalChange])
  const handleRedoShortcut = useCallback(() => {
    if (hasUnsyncedCollaborativeChanges || !canCollaborativeRedo) {
      history.redo()
      return
    }
    redoLocalChange()
  }, [canCollaborativeRedo, hasUnsyncedCollaborativeChanges, history, redoLocalChange])
  const handleStageReady = useCallback((nextStage: Konva.Stage | null) => {
    if (!effectiveReadOnly) handleSelectionExportStageReady(nextStage)
    setStage(nextStage)
  }, [effectiveReadOnly, handleSelectionExportStageReady])
  useKonvaCanvasShortcuts({
    clipboardRef,
    document,
    enabled: !effectiveReadOnly,
    getActivePageId: () => activePageIdRef.current,
    history,
      onClipboardChange: setClipboardShapeCount,
      onRedo: handleRedoShortcut,
      onDocumentChange: setDocument,
      onEdgeSelectionChange: setSelectedEdgeId,
      onImagePasteComplete: handlePendingImagePasteComplete,
      onImagePasteStateChange: handlePendingImagePasteStateChange,
      onPageDocumentChange: boardPages.updatePageDocument,
      getPastePoint: () => lastPastePointRef.current ?? screenToWorld({ x: size.width / 2, y: size.height / 2 }, camera),
      onPanningChange: setIsSpacePanning,
      onSelectionChange: handleSelectionChange,
      onToolChange: handleToolChange,
      onUndo: handleUndoShortcut,
      onCopySelectionSvg: () => { void selectionExport.handleCopySelectionSvg() },
      pageId: boardPages.activePageId,
      selectedEdgeId,
      selectedIds,
      workspace,
  })
  const runContextAction = (action: KonvaContextMenuAction) => {
    const pastePoint = contextMenu ? { x: contextMenu.worldX, y: contextMenu.worldY } : undefined
    setContextMenu(null)
    if (action === 'copy-as-png') {
      void selectionExport.handleCopySelectionPng()
      return
    }
    if (action === 'copy-as-svg') {
      void selectionExport.handleCopySelectionSvg()
      return
    }
    if (action === 'export-png') {
      void selectionExport.handleExportSelectionPng()
      return
    }
    if (action === 'export-svg') {
      selectionExport.handleExportSelectionSvg()
      return
    }
    if (action.startsWith('move-to-page:')) {
      handleMoveSelectionToPage(action.slice('move-to-page:'.length))
      return
    }
    void runKonvaContextAction({
      action,
      clipboardRef,
      document,
      getActivePageId: () => activePageIdRef.current,
      history,
      onClipboardChange: setClipboardShapeCount,
      onDocumentChange: setDocument,
      onImagePasteComplete: handlePendingImagePasteComplete,
      onImagePasteStateChange: handlePendingImagePasteStateChange,
      onPageDocumentChange: boardPages.updatePageDocument,
      onSelectionChange: handleSelectionChange,
      pageId: boardPages.activePageId,
      pastePoint,
      selectedIds,
      workspace,
    })
  }
  return (
    <main className="konva-canvas-shell" data-theme={themeMode}>
      <KonvaCanvasHeader
        boardId={!effectiveReadOnly && mode === 'board' ? boardId : undefined}
        boardTitle={boardTitle}
        collaboration={collaboration}
        localSync={collaborationEnabled ? localYjsSync : undefined}
        onBoardTitleRename={effectiveReadOnly ? undefined : onBoardTitleRename}
      />
      {effectiveReadOnly ? null : (
        <KonvaCanvasToolbar
          activeTool={activeTool}
          isSettingsOpen={settingsOpen}
          onAddStressStrokes={addStressStrokes}
          onClear={clearCanvas}
          onCreateNode={createNodeCard}
          onOpenSettings={() => {
            closeNodeMenu()
            setSettingsOpen((open) => !open)
          }}
          onToolChange={handleToolChange}
        />
      )}
      <section
        className="konva-canvas-stage-wrap"
        data-drop-active={dropHintKind ? 'true' : 'false'}
        data-space-panning={isSpacePanning}
        data-tool-mode={stageToolMode}
        onContextMenu={effectiveReadOnly ? undefined : stageDomEvents.handleContextMenu}
        onDoubleClick={effectiveReadOnly ? undefined : stageDomEvents.handleDoubleClick}
        onDragEnter={effectiveReadOnly ? undefined : stageDomEvents.handleDragEnter}
        onDragLeave={effectiveReadOnly ? undefined : stageDomEvents.handleDragLeave}
        onDragOver={effectiveReadOnly ? undefined : stageDomEvents.handleDragOver}
        onDrop={effectiveReadOnly ? undefined : stageDomEvents.handleDrop}
        onPointerDownCapture={effectiveReadOnly ? undefined : stageDomEvents.handlePointerDownCapture}
        onPointerLeave={stageDomEvents.handlePointerLeave}
        onPointerMoveCapture={collaborationEnabled || !effectiveReadOnly ? stageDomEvents.handlePointerMoveCapture : undefined}
        ref={shellRef}
      >
        {effectiveReadOnly || !dropHintKind ? null : (
          <div className="konva-canvas-drop-hint" aria-hidden="true" data-kind={dropHintKind}>
            <div className="konva-canvas-drop-hint__icon">
              <span />
            </div>
            <div className="konva-canvas-drop-hint__content">
              <strong>{dropHintKind === 'image' ? 'Drop image to upload' : 'Drop PDF on a chat node'}</strong>
              <small>{dropHintKind === 'image' ? 'Empty canvas lands at the current view center.' : 'PDF files attach to chat references rather than the blank canvas.'}</small>
            </div>
          </div>
        )}
        {effectiveReadOnly || !collaborationEnabled ? null : (
          <KonvaLocalSyncBanner localSync={localYjsSync} />
        )}
        <KonvaCanvasPagesPanel
          activeDocument={document}
          activePageId={boardPages.activePageId}
          onCreatePage={handleCreatePage}
          onDeletePage={handleDeletePage}
          onDuplicatePage={handleDuplicatePage}
          onMovePage={handleMovePage}
          onRenamePage={handleRenamePage}
          onSelectPage={boardPages.selectPage}
          pages={boardPages.pages}
          readOnly={effectiveReadOnly}
        />
        {effectiveReadOnly ? (
          <KonvaCanvasViewerStage
            camera={camera}
            document={document}
            height={size.height}
            onCameraCommit={handleCameraCommit}
            onCameraPreview={handleCameraPreview}
            onStageReady={handleStageReady}
            width={size.width}
          />
        ) : (
          <KonvaCanvasStage
            activeTool={activeTool}
            camera={camera}
            captureMode={selectionExport.captureMode}
            cropEditingImageId={cropEditingImageId}
            editingNodeText={editingNodeText}
            editingTextId={editingTextId}
            document={document}
            height={size.height}
            isSpacePanning={isSpacePanning}
            nextStyle={nextStyle}
            pendingImagePastes={visiblePendingImagePastes}
            onCameraCommit={handleCameraCommit}
            onCameraPreview={handleCameraPreview}
            onDocumentChange={setDocument}
            onDocumentPreview={setDocument}
            onEdgeDisconnect={(edgeId) => {
              history.checkpoint(document)
              setDocument((current) => removeKonvaRuntimeEdge(current, edgeId))
              setSelectedEdgeId(null)
            }}
            onEdgeSelect={(edgeId) => {
              setSelectedEdgeId(edgeId)
              handleSelectionChange([])
            }}
            onHistoryCheckpoint={history.checkpoint}
            onImageNodeToCanvas={sendImageNodeToCanvas}
            onNodeChatClean={cleanChatHistory}
            onNodeChatExportToggle={toggleChatMessageExport}
            onNodeChatModelChange={setChatModel}
            onNodeChatSend={sendChatMessage}
            onNodeChatUpload={promptImageNodeUpload}
            onNodeFieldChange={setNodeField}
            onNodeRunToggle={toggleNodeRun}
            onNodeTextEditStart={(shapeId, fieldName) => {
              const editingOwner = remoteEditingOwners.get(shapeId)
              if (editingOwner) {
                setSelectionActionError(`${editingOwner} is already editing this card.`)
                return
              }
              const shape = document.shapes.find((item) => item.id === shapeId)
              if (!shape || shape.type !== 'node_card') return
              handleSelectionChange([shapeId])
              setSelectedEdgeId(null)
              setCropEditingImageId(null)
              setEditingNodeText({ fieldName, shapeId })
            }}
            onSelectionChange={handleSelectionChange}
            onStageReady={handleStageReady}
            onTextEditStart={(shapeId) => {
              const editingOwner = remoteEditingOwners.get(shapeId)
              if (editingOwner) {
                setSelectionActionError(`${editingOwner} is already editing this item.`)
                return
              }
              const shape = document.shapes.find((item) => item.id === shapeId)
              if (shape?.type === 'node_card' && shape.props.nodeType === 'image') {
                if (!canReplaceImageNode(document, shapeId)) return
                promptImageNodeUpload(shapeId)
                return
              }
              if (shape?.type === 'node_card') {
                const fieldName = getEditableKonvaNodeTextField(shape)
                if (fieldName) {
                  setEditingNodeText({ fieldName, shapeId })
                  return
                }
              }
              if (shape && isKonvaEditableTextShape(shape)) setEditingTextId(shapeId)
            }}
            onToolChange={handleToolChange}
            selectedIds={selectedIds}
            selectedEdgeId={selectedEdgeId}
            width={size.width}
          />
        )}
        <KonvaCollaborationOverlay
          activePageId={boardPages.activePageId}
          camera={camera}
          document={document}
          occupancy={collaboration.shapeOccupancy}
          sessions={collaboration.activeSessions}
          stageHeight={size.height}
          stageWidth={size.width}
        />
        {!effectiveReadOnly && nodeMenu ? (
          <KonvaNodeCreateMenu
            onCreateNode={(type) => createNodeCard(type, nodeMenu.world)}
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
          />
        ) : null}
        {!effectiveReadOnly && editingTextShape ? (
          <>
            <button aria-label="Finish text editing" className="konva-canvas-text-editor-backdrop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} type="button" />
            <KonvaTextEditor
              camera={camera}
              onCancel={() => setEditingTextId(null)}
              onCommit={(text) => {
                history.checkpoint(document)
                setDocument((current) => updateTextShape(current, editingTextShape.id, text))
                setEditingTextId(null)
              }}
              shape={editingTextShape}
            />
          </>
        ) : null}
        {!effectiveReadOnly && editingNodeText && editingNodeTextShape ? (
          <>
            <button aria-label="Finish node text editing" className="konva-canvas-text-editor-backdrop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} type="button" />
            <KonvaNodeTextEditor
              camera={camera}
              fieldName={editingNodeText.fieldName}
              onCancel={() => setEditingNodeText(null)}
              onCommit={(value) => {
                setNodeTextField(editingNodeTextShape.id, editingNodeText.fieldName, value)
                setEditingNodeText(null)
              }}
              onSubmit={editingNodeText.fieldName === 'chatDraft' ? (value) => {
                sendChatMessage(editingNodeTextShape.id, value)
                setEditingNodeText(null)
              } : undefined}
              shape={editingNodeTextShape}
            />
          </>
        ) : null}
        {effectiveReadOnly ? null : (
          <KonvaCanvasProperties
            activeTool={activeTool}
            document={document}
            nextStyle={nextStyle}
            onDocumentChange={setDocument}
            onHistoryCheckpoint={history.checkpoint}
            onNextStyleChange={setNextStyle}
            onSelectionChange={handleSelectionChange}
            selectedIds={selectedIds}
          />
        )}
        {effectiveReadOnly ? null : (
          <KonvaSelectionToolbar
            actionError={selectionActionError}
            camera={camera}
            canCaptureSelection={selectionExport.canCaptureSelection}
            canConvertImageToNode={canConvertImageToNode}
            canCropImage={canCropImage}
            canRemoveBackground={imageOps.canRemoveBackground}
            canStartObjectCutout={imageOps.canStartObjectCutout}
            document={document}
            isCapturingSelection={selectionExport.isCapturingSelection}
            isRemovingBackground={imageOps.isRemovingBackground}
            onCaptureSelection={() => { void selectionExport.handleCaptureSelectionToImageNode() }}
            onConvertImageToNode={convertImageToNode}
            onCropImage={cropImage}
            onRemoveBackground={imageOps.removeBackground}
            selectedIds={selectedIds}
            shellRect={shellRect}
          />
        )}
        <KonvaCanvasNavigator
          camera={camera}
          document={document}
          onZoomIn={() => zoomAtCenter(1.12)}
          onZoomOut={() => zoomAtCenter(0.88)}
          onZoomReset={resetZoom}
          stageHeight={size.height}
          stageWidth={size.width}
        />
        {effectiveReadOnly ? null : (
          <KonvaBoardSaveAudit
            ref={saveAuditRef}
            autoLoad={autoLoadBoard}
            boardId={boardId}
            boardTitle={boardTitle}
            camera={camera}
            document={document}
            getPageEnvelope={boardPages.getPageEnvelope}
            activePageId={boardPages.activePageId}
            historyTitle={boardPages.activePageTitle}
            mode={mode}
            onBoardLoaded={(board) => {
              lastKnownBoardSavedAtRef.current = board.savedAt
              setPersistedBoardIds((current) => (current[boardId] ? current : { ...current, [boardId]: true }))
              onBoardLoaded?.(board.title)
            }}
            onBoardSaved={(board) => {
              lastKnownBoardSavedAtRef.current = board.savedAt
              setPersistedBoardIds((current) => (current[boardId] ? current : { ...current, [boardId]: true }))
              onBoardSaved?.(board)
            }}
            onDocumentRestore={(restore) => {
              history.clear()
              boardPages.restorePages(restore)
            }}
            pageRevision={boardPages.revision}
            stage={stage}
            workspace={workspace}
          />
        )}
        {settingsOpen ? <CanvasSettingsPanel boardMode={mode === 'board'} onClose={() => setSettingsOpen(false)} /> : null}
        <KonvaCanvasDiagnostics diagnostics={diagnostics} pointCount={pointCount} zoom={camera.zoom} />
        {effectiveReadOnly ? null : (
          <KonvaContextMenuHost
            activePageId={boardPages.activePageId}
            canLockSelection={canLockSelection}
            canUnlockSelection={canUnlockSelection}
            contextMenu={contextMenu}
            document={document}
            height={size.height}
            onAction={runContextAction}
            onClose={() => setContextMenu(null)}
            pages={boardPages.pages}
            selectedIds={selectedIds}
            width={size.width}
          />
        )}
        <CanvasTooltipLayer />
        {effectiveReadOnly ? null : fileInput}
      </section>
    </main>
  )
}

function createInitialDocument({
  boardTitle,
  initialBoard,
  seedOnMount,
  workspaceId,
}: {
  boardTitle: string
  initialBoard: BoardPersistenceRecord | null
  seedOnMount: boolean
  workspaceId?: string
}) {
  if (initialBoard) {
    try {
      return restoreKonvaBoardDocument(initialBoard.document, {
        workspaceId: initialBoard.workspaceId ?? workspaceId,
      }).document
    } catch {
      // Fall back to an empty document if the shared payload cannot be restored.
    }
  }
  return createEmptyCanvasDocument({
    camera: { x: 120, y: 112, zoom: 1 },
    name: boardTitle,
    shapes: seedOnMount ? createSeedShapes() : [],
  })
}

function isBoardSavedAtNewer(nextSavedAt: string, currentSavedAt: string | null) {
  const nextTime = Date.parse(nextSavedAt)
  if (Number.isNaN(nextTime)) return false
  if (!currentSavedAt) return true
  const currentTime = Date.parse(currentSavedAt)
  if (Number.isNaN(currentTime)) return true
  return nextTime > currentTime
}

function dedupeEditingPresenceShapeIds(shapeIds: Array<string | null | undefined>) {
  return [...new Set(shapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string' && shapeId.length > 0))]
}

function createRemoteEditingOwnerMap(
  occupancy: ReturnType<typeof useBoardCollaborationPresence>['shapeOccupancy'],
) {
  const owners = new Map<string, string>()
  for (const entry of occupancy) {
    if (entry.kind !== 'editing' || entry.isSelf) continue
    for (const shapeId of entry.shapeIds) {
      if (!owners.has(shapeId)) owners.set(shapeId, entry.displayName)
    }
  }
  return owners
}
