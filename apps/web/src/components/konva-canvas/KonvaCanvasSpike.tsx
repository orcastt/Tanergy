'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import * as Y from 'yjs'
import { type CanvasBounds, type CanvasCamera, type CanvasDocument, type CanvasPoint, type CanvasShape, type CanvasShapeStyle } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import { KonvaCanvasShell } from './KonvaCanvasShell'
import { KonvaCanvasTransientUi } from './KonvaCanvasTransientUi'
import type { KonvaNodeImageLightboxState } from './KonvaNodeImageLightbox'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { isKonvaCreateTool, type KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaDefaultShapeStyle } from './konvaCanvasStyle'
import {
  createInitialKonvaSpikeDocument,
  createRemoteEditingOwnerMap,
} from './konvaCanvasSpikeHelpers'
import {
  createKonvaCanvasShellProps,
} from './konvaCanvasShellProps'
import { canCropKonvaImageSelection, getCropImageIdForSelection } from './konvaImageCropCommands'
import { useKonvaBrowserSelectionGuard } from './useKonvaBrowserSelectionGuard'
import { useKonvaBoardPages } from './useKonvaBoardPages'
import { useKonvaCanvasCommandActions } from './useKonvaCanvasCommandActions'
import { useKonvaCanvasControls } from './useKonvaCanvasControls'
import { useKonvaCanvasHistory, type KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import { useKonvaCanvasMetrics } from './useKonvaCanvasMetrics'
import { useKonvaCanvasPageActions } from './useKonvaCanvasPageActions'
import { useKonvaImageOpsActions } from './useKonvaImageOpsActions'
import { useKonvaImageNodeActions } from './useKonvaImageNodeActions'
import { useKonvaImageNodeUpload } from './useKonvaImageNodeUpload'
import { useKonvaNodeCreationMenu } from './useKonvaNodeCreationMenu'
import { useKonvaSelectionExportActions } from './useKonvaSelectionExportActions'
import { useKonvaStageDomEvents } from './useKonvaStageDomEvents'
import { useKonvaFocusedEditOccupancy } from './useKonvaFocusedEditOccupancy'
import { useBoardCollaborationPresence } from './useBoardCollaborationPresence'
import type { KonvaCollaborationEdgeSession } from './KonvaNodeEdgeLayer'
import { useKonvaCanvasBoardSync } from './useKonvaCanvasBoardSync'
import { useKonvaCanvasTextEditing } from './useKonvaCanvasTextEditing'
import { useKonvaPendingImagePastes } from './useKonvaPendingImagePastes'

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
  const [document, setDocument] = useState<CanvasDocument>(() => createInitialKonvaSpikeDocument({
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionMarqueeBounds, setSelectionMarqueeBounds] = useState<CanvasBounds | null>(null)
  const [transformPreview, setTransformPreview] = useState<{ bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connectionPreviewPresence, setConnectionPreviewPresence] = useState<BoardCollaborationConnectionPreview | null>(null)
  const [cropEditingImageId, setCropEditingImageId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingNodeText, setEditingNodeText] = useState<{ fieldName: KonvaNodeTextFieldName; shapeId: string } | null>(null)
  const [nodeImageLightbox, setNodeImageLightbox] = useState<KonvaNodeImageLightboxState | null>(null)
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
  const lastPastePointRef = useRef<CanvasPoint | null>(null)
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
  const { cleanChatHistory, closeNodeMenu, createNodeCard, nodeMenu, openNodeMenu, regenerateChatMessage, sendChatMessage, setChatModel, setNodeField, setNodeTextField, toggleNodeRun } = useKonvaNodeCreationMenu({
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
  const { fileInput, promptImageNodeUpload, uploadDropFileAtPoint } = useKonvaImageNodeUpload({
    document,
    history,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    workspace,
  })
  const clearTransientState = useCallback(() => {
    handleSelectionChange([])
    setConnectionPreviewPresence(null)
    setSelectionMarqueeBounds(null)
    setTransformPreview(null)
    setSelectedEdgeId(null)
    setCropEditingImageId(null)
    setEditingTextId(null)
    setEditingNodeText(null)
    setNodeImageLightbox(null)
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
  const collaborationPageSummaries = useMemo(() => (
    boardPages.pages.map((page) => ({
      id: page.id,
      title: page.title || page.canvasDocument.metadata.name || 'Untitled page',
    }))
  ), [boardPages.pages])
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
    selectedIds,
    tool: activeToolPreference,
    transformBox: readOnly ? null : transformPreview?.bounds ?? null,
    transformKind: readOnly ? null : transformPreview?.kind ?? null,
    workspace,
  })
  const remoteEdgeSessions = useMemo<KonvaCollaborationEdgeSession[]>(() => (
    collaboration.activeSessions
      .filter((session) => !session.isSelf)
      .filter((session) => {
        const sessionPageId = session.presence.activePageId ?? null
        return !sessionPageId || sessionPageId === boardPages.activePageId
      })
      .filter((session) => Boolean(session.presence.selectedEdgeId || session.presence.connectionPreview))
      .map((session) => ({
        clientInstanceId: session.clientInstanceId,
        connectionPreview: session.presence.connectionPreview ?? null,
        displayName: session.displayName,
        selectedEdgeId: session.presence.selectedEdgeId ?? null,
        sessionId: session.id,
      }))
  ), [boardPages.activePageId, collaboration.activeSessions])
  const setCollaborationEditingShapeIds = collaboration.setEditingShapeIds
  const remoteEditingOwners = useMemo(() => createRemoteEditingOwnerMap(collaboration.shapeOccupancy), [collaboration.shapeOccupancy])
  const effectiveReadOnly = readOnly || (collaboration.status === 'ready' && !collaboration.canEdit)
  const activeTool = effectiveReadOnly ? 'hand' : activeToolState
  const stageToolMode = effectiveReadOnly ? 'view' : isKonvaCreateTool(activeTool) ? 'create' : activeTool
  useEffect(() => {
    interactionLockedRef.current = effectiveReadOnly
  }, [effectiveReadOnly])
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
    setCollaborationEditingShapeIds(editingPresenceShapeIds)
  }, [editingPresenceShapeIds, setCollaborationEditingShapeIds])
  const {
    editingNodeTextShape,
    editingTextShape,
    handleEditingNodeTextCommit,
    handleEditingNodeTextSubmit,
    handleEditingTextCommit,
    handleStageNodeTextEditStart,
    handleStageTextEditStart,
  } = useKonvaCanvasTextEditing({
    document,
    editingNodeText,
    editingTextId,
    history,
    promptImageNodeUpload,
    requestFocusedEditShape,
    sendChatMessage,
    setDocument,
    setEditingNodeText,
    setEditingTextId,
    setNodeTextField,
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
  const openNodeImageLightbox = useCallback((state: KonvaNodeImageLightboxState) => {
    setNodeImageLightbox(state)
  }, [])

  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])
  const selectedShapes = useMemo(() => {
    const selected = new Set(selectedIds)
    return document.shapes.filter((shape) => selected.has(shape.id))
  }, [document.shapes, selectedIds])
  const canLockSelection = selectedShapes.some((shape) => !shape.isLocked)
  const canUnlockSelection = selectedShapes.some((shape) => shape.isLocked)
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
    if (!requestFocusedEditShape(imageId, 'image')) return
    setCropEditingImageId((current) => (current === imageId ? null : imageId))
    handleToolChange('select')
  }, [document, handleToolChange, requestFocusedEditShape, selectedIds])
  const {
    handleCreatePage,
    handleDeletePage,
    handleDuplicatePage,
    handleMovePage,
    handleMoveSelectionToPage,
    handleRenamePage,
  } = useKonvaCanvasPageActions({
    boardPages,
    document,
    history,
    selectedIds,
  })
  const { canConvertImageToNode, convertImageToNode, sendGeneratedOutputToCanvas, sendImageNodeToCanvas } = useKonvaImageNodeActions({
    activePageId: boardPages.activePageId,
    document,
    history,
    onDocumentChange: setDocument,
    onPendingImagePasteComplete: handlePendingImagePasteComplete,
    onPendingImagePasteStateChange: handlePendingImagePasteStateChange,
    onSelectionChange: handleSelectionChange,
    selectedIds,
    workspace,
  })
  const selectionExport = useKonvaSelectionExportActions({
    document,
    history,
    onActionError: setSelectionActionError,
    onDocumentChange: setDocument,
    onSelectionChange: handleSelectionChange,
    selectedIds,
    workspace,
  })
  const {
    handleEdgeDisconnect,
    handleEdgeSelect,
    handleStageReady,
    handleToolbarOpenSettings,
    runContextAction,
  } = useKonvaCanvasCommandActions({
    boardPages,
    camera,
    clipboardRef,
    closeNodeMenu,
    contextMenu,
    document,
    effectiveReadOnly,
    handleMoveSelectionToPage,
    history,
    lastPastePointRef,
    localYjsSync,
    onDocumentChange: setDocument,
    onImagePasteComplete: handlePendingImagePasteComplete,
    onImagePasteStateChange: handlePendingImagePasteStateChange,
    onSelectionChange: handleSelectionChange,
    onToolChange: handleToolChange,
    selectedEdgeId,
    selectedIds,
    selectionExport,
    setClipboardShapeCount,
    setContextMenu,
    setIsSpacePanning,
    setSelectedEdgeId,
    setSettingsOpen,
    setStage,
    size,
    workspace,
  })
  const markBoardPersisted = useCallback((savedBoardId: string) => {
    setPersistedBoardIds((current) => (current[savedBoardId] ? current : { ...current, [savedBoardId]: true }))
  }, [])
  const handleSaveAuditBoardLoaded = useCallback((board: BoardPersistenceSummary) => {
    markBoardSavedAt(board.savedAt)
    markBoardPersisted(boardId)
    onBoardLoaded?.(board.title)
  }, [boardId, markBoardPersisted, markBoardSavedAt, onBoardLoaded])
  const handleSaveAuditBoardSaved = useCallback((board: BoardPersistenceSummary) => {
    markBoardSavedAt(board.savedAt)
    markBoardPersisted(boardId)
    onBoardSaved?.(board)
  }, [boardId, markBoardPersisted, markBoardSavedAt, onBoardSaved])
  const shellProps = createKonvaCanvasShellProps({
    activeTool,
    addStressStrokes,
    boardId,
    boardTitle,
    camera,
    clearCanvas,
    collaboration,
    collaborationEnabled,
    collaborationPageSummaries,
    createNodeCard,
    document,
    dropHintKind,
    effectiveReadOnly,
    handleCameraCommit,
    handleCameraPreview,
    handleCreatePage,
    handleDeletePage,
    handleDuplicatePage,
    handleMovePage,
    handleRenamePage,
    handleSelectionChange,
    handleStageNodeTextEditStart,
    handleStageReady,
    handleStageTextEditStart,
    handleToolbarOpenSettings,
    handleToolChange,
    headerLocalSync: collaborationEnabled ? localYjsSync : undefined,
    isSpacePanning,
    localSyncBannerProps: collaborationEnabled ? { localSync: localYjsSync } : undefined,
    mode,
    nextStyle,
    onBoardTitleRename,
    overlayOccupancy: collaboration.shapeOccupancy,
    overlaySessions: collaboration.activeSessions,
    remoteEdgeSessions,
    requestFocusedEdit: requestFocusedEditShape,
    selectionExportCaptureMode: selectionExport.captureMode,
    sendGeneratedOutputToCanvas,
    sendImageNodeToCanvas,
    setConnectionPreviewPresence,
    setDocument,
    setFocusedControlShapeState,
    setNodeField,
    setSelectionMarqueeBounds,
    setTransformPreview,
    settingsOpen,
    size,
    stageDomEvents,
    stageToolMode,
    themeMode,
    toggleNodeRun,
    boardPages: {
      activePageId: boardPages.activePageId,
      pages: boardPages.pages,
      selectPage: boardPages.selectPage,
    },
    writableStagePropsExtras: {
      cropEditingImageId,
      editingNodeText,
      editingTextId,
      onEdgeDisconnect: handleEdgeDisconnect,
      onEdgeSelect: handleEdgeSelect,
      onHistoryCheckpoint: history.checkpoint,
      onNodeChatClean: cleanChatHistory,
      onNodeChatModelChange: setChatModel,
      onNodeChatRegenerate: regenerateChatMessage,
      onNodeChatSend: sendChatMessage,
      onNodeChatUpload: promptImageNodeUpload,
      onNodeImagePreviewOpen: openNodeImageLightbox,
      pendingImagePastes: visiblePendingImagePastes,
      selectedEdgeId,
      selectedIds,
    },
  })
  const transientUiProps = {
    contextMenuHostProps: effectiveReadOnly ? undefined : {
      activePageId: boardPages.activePageId,
      canLockSelection,
      canUnlockSelection,
      contextMenu,
      document,
      height: size.height,
      onAction: runContextAction,
      onClose: () => setContextMenu(null),
      pages: boardPages.pages,
      selectedIds,
      width: size.width,
    },
    diagnosticsProps: {
      diagnostics,
      pointCount,
      zoom: camera.zoom,
    },
    fileInput: effectiveReadOnly ? null : fileInput,
    focusedEditNotice,
    lightboxKey: nodeImageLightbox
      ? `${nodeImageLightbox.title}:${nodeImageLightbox.batches[0]?.[0]?.assetId ?? 'image'}:${nodeImageLightbox.batches.length}`
      : undefined,
    lightboxProps: nodeImageLightbox ? {
      onClose: () => setNodeImageLightbox(null),
      state: nodeImageLightbox,
    } : undefined,
    navigatorProps: {
      camera,
      document,
      onZoomIn: () => zoomAtCenter(1.12),
      onZoomOut: () => zoomAtCenter(0.88),
      onZoomReset: resetZoom,
      stageHeight: size.height,
      stageWidth: size.width,
    },
    nodeCreateMenuProps: !effectiveReadOnly && nodeMenu ? {
      onCreateNode: (type: Parameters<typeof createNodeCard>[0]) => createNodeCard(type, nodeMenu.world),
      style: { left: nodeMenu.x, top: nodeMenu.y },
    } : undefined,
    nodeTextEditorProps: !effectiveReadOnly && editingNodeText && editingNodeTextShape ? {
      camera,
      fieldName: editingNodeText.fieldName,
      onCancel: () => setEditingNodeText(null),
      onCommit: handleEditingNodeTextCommit,
      onSubmit: handleEditingNodeTextSubmit,
      shape: editingNodeTextShape,
    } : undefined,
    propertiesProps: effectiveReadOnly ? undefined : {
      activeTool,
      document,
      nextStyle,
      onDocumentChange: setDocument,
      onHistoryCheckpoint: history.checkpoint,
      onNextStyleChange: setNextStyle,
      onSelectionChange: handleSelectionChange,
      selectedIds,
    },
    saveAuditProps: effectiveReadOnly ? undefined : {
      ref: saveAuditRef,
      autoLoad: autoLoadBoard,
      boardId,
      boardTitle,
      camera,
      document,
      getPageEnvelope: boardPages.getPageEnvelope,
      activePageId: boardPages.activePageId,
      historyTitle: boardPages.activePageTitle,
      mode,
      onBoardLoaded: handleSaveAuditBoardLoaded,
      onBoardSaved: handleSaveAuditBoardSaved,
      onDocumentRestore: (restore: Parameters<typeof boardPages.restorePages>[0]) => {
        history.clear()
        boardPages.restorePages(restore)
      },
      pageRevision: boardPages.revision,
      stage,
      workspace,
    },
    selectionToolbarProps: effectiveReadOnly ? undefined : {
      actionError: selectionActionError,
      camera,
      canCaptureSelection: selectionExport.canCaptureSelection,
      canConvertImageToNode,
      canCropImage,
      canRemoveBackground: imageOps.canRemoveBackground,
      canStartObjectCutout: imageOps.canStartObjectCutout,
      document,
      isCapturingSelection: selectionExport.isCapturingSelection,
      isRemovingBackground: imageOps.isRemovingBackground,
      onCaptureSelection: () => { void selectionExport.handleCaptureSelectionToImageNode() },
      onConvertImageToNode: convertImageToNode,
      onCropImage: cropImage,
      onRemoveBackground: imageOps.removeBackground,
      selectedIds,
      shellRect,
    },
    settingsPanelProps: settingsOpen ? {
      boardMode: mode === 'board',
      onClose: () => setSettingsOpen(false),
    } : undefined,
    textEditorProps: !effectiveReadOnly && editingTextShape ? {
      camera,
      onCancel: () => setEditingTextId(null),
      onCommit: handleEditingTextCommit,
      shape: editingTextShape,
    } : undefined,
  }

  return (
    <KonvaCanvasShell {...shellProps} shellRef={shellRef}>
      <KonvaCanvasTransientUi {...transientUiProps} />
    </KonvaCanvasShell>
  )
}
