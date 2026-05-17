'use client'

import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import type Konva from 'konva'
import * as Y from 'yjs'
import type { CanvasBounds, CanvasCamera, CanvasDocument, CanvasPoint, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { createKonvaCanvasSpikeShellProps, createKonvaCanvasSpikeTransientUiProps } from './konvaCanvasSpikeViewProps'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import type { KonvaNodeImageLightboxState } from './KonvaNodeImageLightbox'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { useKonvaBoardPages } from './useKonvaBoardPages'
import { useKonvaCanvasBoardCollaborationBridge } from './useKonvaCanvasBoardCollaborationBridge'
import { useKonvaCanvasDocumentChangeBridge } from './useKonvaCanvasDocumentChangeBridge'
import { useKonvaCanvasCommandActions } from './useKonvaCanvasCommandActions'
import { useKonvaCanvasControls } from './useKonvaCanvasControls'
import { useKonvaCanvasHistory, type KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import { useKonvaCanvasMetrics } from './useKonvaCanvasMetrics'
import { useKonvaCanvasPageActions } from './useKonvaCanvasPageActions'
import { useKonvaCanvasSelectionSaveState } from './useKonvaCanvasSelectionSaveState'
import { useKonvaCanvasTextEditing } from './useKonvaCanvasTextEditing'
import { useKonvaImageNodeActions } from './useKonvaImageNodeActions'
import { useKonvaImageNodeUpload } from './useKonvaImageNodeUpload'
import { useKonvaImageOpsActions } from './useKonvaImageOpsActions'
import { useKonvaNodeCreationMenu } from './useKonvaNodeCreationMenu'
import { useKonvaSelectionExportActions } from './useKonvaSelectionExportActions'
import { useKonvaStageDomEvents } from './useKonvaStageDomEvents'

type NodeMenuApi = Pick<ReturnType<typeof useKonvaNodeCreationMenu>,
  'cleanChatHistory' | 'closeNodeMenu' | 'createNodeCard' | 'nodeMenu' | 'openNodeMenu' |
  'regenerateChatMessage' | 'sendChatMessage' | 'setChatModel' | 'setNodeField' |
  'setNodeTextField' | 'toggleNodeRun'>
type ImageUploadApi = Pick<ReturnType<typeof useKonvaImageNodeUpload>, 'fileInput' | 'promptImageNodeUpload' | 'uploadDropFileAtPoint'>
type MetricsApi = ReturnType<typeof useKonvaCanvasMetrics>

type CanvasState = {
  activeToolPreference: KonvaCanvasTool
  camera: CanvasCamera
  connectionPreviewPresence: BoardCollaborationConnectionPreview | null
  contextMenu: { worldX: number; worldY: number; x: number; y: number } | null
  cropEditingImageId: string | null
  document: CanvasDocument
  dropHintKind: 'image' | 'pdf' | null
  editingNodeText: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingTextId: string | null
  nextStyle: CanvasShapeStyle
  nodeImageLightbox: KonvaNodeImageLightboxState | null
  selectedEdgeId: string | null
  selectedIds: string[]
  selectionActionError: string | null
  selectionMarqueeBounds: CanvasBounds | null
  settingsOpen: boolean
  stage: Konva.Stage | null
  transformPreview: { bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null
}

type CanvasSetters = {
  setCamera: Dispatch<SetStateAction<CanvasCamera>>
  setClipboardShapeCount: Dispatch<SetStateAction<number>>
  setConnectionPreviewPresence: Dispatch<SetStateAction<BoardCollaborationConnectionPreview | null>>
  setContextMenu: Dispatch<SetStateAction<CanvasState['contextMenu']>>
  setCropEditingImageId: Dispatch<SetStateAction<string | null>>
  setDocument: Dispatch<SetStateAction<CanvasDocument>>
  setDocumentState: Dispatch<SetStateAction<CanvasDocument>>
  setDropHintKind: Dispatch<SetStateAction<'image' | 'pdf' | null>>
  setEditingNodeText: Dispatch<SetStateAction<CanvasState['editingNodeText']>>
  setEditingTextId: Dispatch<SetStateAction<string | null>>
  setIsSpacePanning: Dispatch<SetStateAction<boolean>>
  setNextStyle: Dispatch<SetStateAction<CanvasShapeStyle>>
  setNodeImageLightbox: Dispatch<SetStateAction<KonvaNodeImageLightboxState | null>>
  setPersistedBoardIds: Dispatch<SetStateAction<Record<string, true>>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  setSelectionActionError: Dispatch<SetStateAction<string | null>>
  setSelectionMarqueeBounds: Dispatch<SetStateAction<CanvasBounds | null>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setStage: Dispatch<SetStateAction<Konva.Stage | null>>
  setTransformPreview: Dispatch<SetStateAction<CanvasState['transformPreview']>>
}

type UseKonvaCanvasSpikeRuntimeOptions = {
  autoLoadBoard: boolean
  boardId: string
  boardTitle: string
  boardPageHistoryRef: MutableRefObject<{
    getPageState?: (document: CanvasDocument) => KonvaCanvasHistoryPageState | null
    restorePageState?: (state: KonvaCanvasHistoryPageState) => void
  }>
  canvasSetters: CanvasSetters
  canvasState: CanvasState
  clipboardRef: MutableRefObject<CanvasShape[]>
  clearTransientState: () => void
  documentChangeBridgeRef: MutableRefObject<Dispatch<SetStateAction<CanvasDocument>> | null>
  handleSelectionChange: (shapeIds: string[]) => void
  handleToolChange: (tool: KonvaCanvasTool) => void
  hasPersistedBoard: boolean
  history: ReturnType<typeof useKonvaCanvasHistory>
  imageUploadApi: ImageUploadApi
  initialBoard: BoardPersistenceRecord | null
  interactionLockedRef: MutableRefObject<boolean>
  isSpacePanning: boolean
  lastPastePointRef: RefObject<CanvasPoint | null>
  metrics: MetricsApi
  mode: 'board' | 'dev'
  nodeMenuApi: NodeMenuApi
  onBoardLoaded?: (title: string) => void
  onBoardSaved?: (board: BoardPersistenceSummary) => void
  onBoardTitleRename?: (title: string) => Promise<string | void> | string | void
  readOnly: boolean
  saveAuditRef: RefObject<KonvaBoardSaveAuditHandle | null>
  themeMode: string
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

export function useKonvaCanvasSpikeRuntime({
  autoLoadBoard,
  boardId,
  boardTitle,
  boardPageHistoryRef,
  canvasSetters,
  canvasState,
  clipboardRef,
  clearTransientState,
  documentChangeBridgeRef,
  handleSelectionChange,
  handleToolChange,
  hasPersistedBoard,
  history,
  imageUploadApi,
  initialBoard,
  interactionLockedRef,
  isSpacePanning,
  lastPastePointRef,
  metrics,
  mode,
  nodeMenuApi,
  onBoardLoaded,
  onBoardSaved,
  onBoardTitleRename,
  readOnly,
  saveAuditRef,
  themeMode,
  workspace,
  ydoc,
}: UseKonvaCanvasSpikeRuntimeOptions) {
  const { diagnostics, setShellRect, shellRect, size } = metrics
  const { cleanChatHistory, closeNodeMenu, createNodeCard, nodeMenu, openNodeMenu, regenerateChatMessage, sendChatMessage, setChatModel, setNodeField, setNodeTextField, toggleNodeRun } = nodeMenuApi
  const { fileInput, promptImageNodeUpload, uploadDropFileAtPoint } = imageUploadApi
  const { activeToolPreference, camera, connectionPreviewPresence, contextMenu, cropEditingImageId, document, dropHintKind, editingNodeText, editingTextId, nextStyle, nodeImageLightbox, selectedEdgeId, selectedIds, selectionActionError, selectionMarqueeBounds, settingsOpen, stage, transformPreview } = canvasState
  const { setCamera, setClipboardShapeCount, setConnectionPreviewPresence, setContextMenu, setCropEditingImageId, setDocument, setDocumentState, setDropHintKind, setEditingNodeText, setEditingTextId, setIsSpacePanning, setNextStyle, setNodeImageLightbox, setPersistedBoardIds, setSelectedEdgeId, setSelectionActionError, setSelectionMarqueeBounds, setSettingsOpen, setStage, setTransformPreview } = canvasSetters

  const boardPages = useKonvaBoardPages({ activeDocument: document, camera, onCameraChange: setCamera, onDocumentChange: setDocumentState, onTransientClear: clearTransientState })
  useKonvaCanvasDocumentChangeBridge({
    activePageId: boardPages.activePageId,
    bridgeRef: documentChangeBridgeRef,
    updatePageDocument: boardPages.updatePageDocument,
  })
  const collaboration = useKonvaCanvasBoardCollaborationBridge({
    activeToolPreference, boardId, boardPageHistoryRef, boardPages, clearTransientState, connectionPreviewPresence, cropEditingImageId,
    document, editingNodeText, editingTextId, handleSelectionChange, hasPersistedBoard, history, initialBoard, interactionLockedRef,
    mode, onBoardLoaded, readOnly, saveAuditRef, selectedEdgeId, selectedIds, selectionMarqueeBounds, setCropEditingImageId,
    setSelectedEdgeId, setSettingsOpen, transformPreview, workspace, ydoc,
  })
  const textEditing = useKonvaCanvasTextEditing({
    document, editingNodeText, editingTextId, history, promptImageNodeUpload, requestFocusedEditShape: collaboration.requestFocusedEditShape,
    sendChatMessage, setDocument, setEditingNodeText, setEditingTextId, setNodeTextField,
  })
  const stageDomEvents = useKonvaStageDomEvents({
    camera, document, lastPastePointRef, nodeMenuOpen: Boolean(nodeMenu), onCanvasDoubleClick: openNodeMenu, onContextMenuChange: setContextMenu,
    onDropHintChange: setDropHintKind, onHoveredShapeIdChange: collaboration.collaboration.setHoveredShapeId,
    onNodeMenuClose: closeNodeMenu, onPointerWorldChange: collaboration.collaboration.setCursor, onSelectionChange: handleSelectionChange,
    onShellRectChange: setShellRect, onToolChange: handleToolChange, onUploadDropFileAtPoint: uploadDropFileAtPoint, selectedIds,
  })

  const openNodeImageLightbox = useCallback((state: KonvaNodeImageLightboxState) => setNodeImageLightbox(state), [setNodeImageLightbox])
  const selectionSaveState = useKonvaCanvasSelectionSaveState({
    boardId, document, handleToolChange, markBoardSavedAt: collaboration.markBoardSavedAt, onBoardLoaded, onBoardSaved,
    requestFocusedEditShape: collaboration.requestFocusedEditShape, selectedIds, setCropEditingImageId, setPersistedBoardIds,
  })
  const imageOps = useKonvaImageOpsActions({ document, history, onActionError: setSelectionActionError, onDocumentChange: setDocument, onSelectionChange: handleSelectionChange, selectedIds, workspace })
  const controls = useKonvaCanvasControls({
    camera,
    history,
    onCameraChange: setCamera,
    onCameraDocumentChange: setDocumentState,
    onContentDocumentChange: setDocument,
    onEdgeSelectionChange: setSelectedEdgeId,
    onSelectionChange: handleSelectionChange,
    size,
  })
  const pageActions = useKonvaCanvasPageActions({ boardPages, document, history, selectedIds })
  const imageNodeActions = useKonvaImageNodeActions({
    activePageId: boardPages.activePageId, document, history, onDocumentChange: setDocument, onPendingImagePasteComplete: collaboration.handlePendingImagePasteComplete,
    onPendingImagePasteStateChange: collaboration.handlePendingImagePasteStateChange, onSelectionChange: handleSelectionChange, selectedIds, workspace,
  })
  const selectionExport = useKonvaSelectionExportActions({ document, history, onActionError: setSelectionActionError, onDocumentChange: setDocument, onSelectionChange: handleSelectionChange, selectedIds, workspace })
  const commandActions = useKonvaCanvasCommandActions({
    boardPages, camera, clipboardRef, closeNodeMenu, contextMenu, document, effectiveReadOnly: collaboration.effectiveReadOnly,
    handleMoveSelectionToPage: pageActions.handleMoveSelectionToPage, history, lastPastePointRef, localYjsSync: collaboration.localYjsSync, onDocumentChange: setDocument,
    onImagePasteComplete: collaboration.handlePendingImagePasteComplete, onImagePasteStateChange: collaboration.handlePendingImagePasteStateChange,
    onSelectionChange: handleSelectionChange, onToolChange: handleToolChange, selectedEdgeId, selectedIds, selectionExport, setClipboardShapeCount,
    setContextMenu, setIsSpacePanning, setSelectedEdgeId, setSettingsOpen, setStage, size, workspace,
  })

  const shellProps = createKonvaCanvasSpikeShellProps({
    shellOptions: {
      activeTool: collaboration.activeTool, addStressStrokes: controls.addStressStrokes, boardId, boardTitle, camera, clearCanvas: controls.clearCanvas,
      collaboration: collaboration.collaboration, collaborationEnabled: collaboration.collaborationEnabled, collaborationPageSummaries: collaboration.collaborationPageSummaries,
      createNodeCard, document, dropHintKind, effectiveReadOnly: collaboration.effectiveReadOnly, handleCameraCommit: controls.handleCameraCommit,
      handleCameraPreview: controls.handleCameraPreview, handleCreatePage: pageActions.handleCreatePage, handleDeletePage: pageActions.handleDeletePage,
      handleDuplicatePage: pageActions.handleDuplicatePage, handleMovePage: pageActions.handleMovePage, handleRenamePage: pageActions.handleRenamePage,
      handleSelectionChange, handleStageNodeTextEditStart: textEditing.handleStageNodeTextEditStart, handleStageReady: commandActions.handleStageReady,
      handleStageTextEditStart: textEditing.handleStageTextEditStart, handleToolbarOpenSettings: commandActions.handleToolbarOpenSettings, handleToolChange,
      headerLocalSync: collaboration.collaborationEnabled ? collaboration.localYjsSync : undefined, isSpacePanning, localSyncBannerProps: collaboration.collaborationEnabled ? { localSync: collaboration.localYjsSync } : undefined,
      mode, nextStyle, onBoardTitleRename, overlayOccupancy: collaboration.collaboration.shapeOccupancy, overlaySessions: collaboration.collaboration.activeSessions,
      remoteEdgeSessions: collaboration.remoteEdgeSessions, requestFocusedEdit: collaboration.requestFocusedEditShape, selectionExportCaptureMode: selectionExport.captureMode,
      sendGeneratedOutputToCanvas: imageNodeActions.sendGeneratedOutputToCanvas, sendImageNodeToCanvas: imageNodeActions.sendImageNodeToCanvas,
      setConnectionPreviewPresence, setDocument, setFocusedControlShapeState: collaboration.setFocusedControlShapeState, setNodeField, setSelectionMarqueeBounds,
      setTransformPreview, settingsOpen, size, stageDomEvents, stageToolMode: collaboration.stageToolMode, themeMode, toggleNodeRun,
      boardPages: { activePageId: boardPages.activePageId, pages: boardPages.pages, selectPage: boardPages.selectPage },
      writableStagePropsExtras: {
        cropEditingImageId, editingNodeText, editingTextId, onEdgeDisconnect: commandActions.handleEdgeDisconnect, onEdgeSelect: commandActions.handleEdgeSelect,
        onHistoryCheckpoint: history.checkpoint, onNodeChatClean: cleanChatHistory, onNodeChatModelChange: setChatModel, onNodeChatRegenerate: regenerateChatMessage,
        onNodeChatSend: sendChatMessage, onNodeChatUpload: promptImageNodeUpload, onNodeImagePreviewOpen: openNodeImageLightbox,
        pendingImagePastes: collaboration.visiblePendingImagePastes, selectedEdgeId, selectedIds,
      },
    },
  })

  const transientUiProps = createKonvaCanvasSpikeTransientUiProps({
    activePageId: boardPages.activePageId, activeTool: collaboration.activeTool, autoLoadBoard, boardId, boardTitle, camera, canCaptureSelection: selectionExport.canCaptureSelection,
    canConvertImageToNode: imageNodeActions.canConvertImageToNode, canCropImage: selectionSaveState.canCropImage, canLockSelection: selectionSaveState.canLockSelection,
    canRemoveBackground: imageOps.canRemoveBackground, canStartObjectCutout: imageOps.canStartObjectCutout, canUnlockSelection: selectionSaveState.canUnlockSelection,
    contextMenu, convertImageToNode: imageNodeActions.convertImageToNode, createNodeCard, cropImage: selectionSaveState.cropImage, diagnostics, document, editingNodeText,
    editingNodeTextShape: textEditing.editingNodeTextShape, editingTextShape: textEditing.editingTextShape, effectiveReadOnly: collaboration.effectiveReadOnly,
    fileInput, focusedEditNotice: collaboration.focusedEditNotice, getPageEnvelope: boardPages.getPageEnvelope, handleCaptureSelectionToImageNode: selectionExport.handleCaptureSelectionToImageNode,
    handleEditingNodeTextCommit: textEditing.handleEditingNodeTextCommit, handleEditingNodeTextSubmit: textEditing.handleEditingNodeTextSubmit, handleEditingTextCommit: textEditing.handleEditingTextCommit,
    historyClear: history.clear, historyTitle: boardPages.activePageTitle, isCapturingSelection: selectionExport.isCapturingSelection, isRemovingBackground: imageOps.isRemovingBackground,
    lightboxState: nodeImageLightbox, mode, navigatorStageHeight: size.height, navigatorStageWidth: size.width, nextStyle, nodeMenu, onBoardLoaded: selectionSaveState.handleSaveAuditBoardLoaded,
    onBoardSaved: selectionSaveState.handleSaveAuditBoardSaved, onCloseContextMenu: () => setContextMenu(null), onCloseLightbox: () => setNodeImageLightbox(null),
    onCloseNodeTextEditor: () => setEditingNodeText(null), onCloseSettings: () => setSettingsOpen(false), onCloseTextEditor: () => setEditingTextId(null),
    onContextAction: commandActions.runContextAction, onDocumentChange: setDocument, onDocumentRestore: boardPages.restorePages, onHistoryCheckpoint: history.checkpoint,
    onNextStyleChange: setNextStyle, onRemoveBackground: imageOps.removeBackground, onSelectionChange: handleSelectionChange, onZoomIn: () => controls.zoomAtCenter(1.12),
    onZoomOut: () => controls.zoomAtCenter(0.88), onZoomReset: controls.resetZoom, pageRevision: boardPages.revision, pages: boardPages.pages, pointCount: selectionSaveState.pointCount,
    saveAuditRef, selectedIds, selectionActionError, settingsOpen, shellRect, size, stage, workspace, zoom: camera.zoom,
  })

  return { shellProps, transientUiProps }
}
