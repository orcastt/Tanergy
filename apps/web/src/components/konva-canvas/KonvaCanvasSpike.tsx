'use client'

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type Konva from 'konva'
import * as Y from 'yjs'
import { type CanvasBounds, type CanvasCamera, type CanvasDocument, type CanvasPoint, type CanvasShape, type CanvasShapeStyle } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardCollaborationConnectionPreview } from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import { KonvaCanvasShell } from './KonvaCanvasShell'
import { KonvaCanvasTransientUi } from './KonvaCanvasTransientUi'
import type { KonvaNodeImageLightboxState } from './KonvaNodeImageLightbox'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { konvaDefaultShapeStyle } from './konvaCanvasStyle'
import {
  createInitialKonvaSpikeDocument,
} from './konvaCanvasSpikeHelpers'
import { useKonvaBrowserSelectionGuard } from './useKonvaBrowserSelectionGuard'
import { useKonvaCanvasHistory, type KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import { useKonvaCanvasMetrics } from './useKonvaCanvasMetrics'
import { useKonvaImageNodeUpload } from './useKonvaImageNodeUpload'
import { useKonvaNodeCreationMenu } from './useKonvaNodeCreationMenu'
import { useKonvaCanvasSpikeRuntime } from './useKonvaCanvasSpikeRuntime'
import { useKonvaTransformPreviewState } from './useKonvaTransformPreviewState'

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
  const [document, setDocumentState] = useState<CanvasDocument>(() => createInitialKonvaSpikeDocument({
    boardTitle,
    initialBoard,
    seedOnMount,
    workspaceId: initialBoard?.workspaceId ?? workspace?.id,
  }))
  const documentChangeBridgeRef = useRef<Dispatch<SetStateAction<CanvasDocument>> | null>(null)
  const setDocument = useCallback<Dispatch<SetStateAction<CanvasDocument>>>((update) => {
    const bridge = documentChangeBridgeRef.current
    if (bridge) {
      bridge(update)
      return
    }
    setDocumentState(update)
  }, [])
  const [camera, setCamera] = useState<CanvasCamera>(document.camera)
  const [activeToolState, setActiveToolState] = useState<KonvaCanvasTool>('select')
  const activeToolPreference = readOnly ? 'hand' : activeToolState
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const [nextStyle, setNextStyle] = useState<CanvasShapeStyle>(konvaDefaultShapeStyle)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [interactionShapeIds, setInteractionShapeIds] = useState<string[]>([])
  const [selectionMarqueeBounds, setSelectionMarqueeBounds] = useState<CanvasBounds | null>(null)
  const { setTransformPreview, setTransformPreviewThrottled, transformPreview } = useKonvaTransformPreviewState()
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connectionPreviewPresence, setConnectionPreviewPresence] = useState<BoardCollaborationConnectionPreview | null>(null)
  const [cropEditingImageId, setCropEditingImageId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingNodeText, setEditingNodeText] = useState<{ fieldName: KonvaNodeTextFieldName; shapeId: string } | null>(null)
  const [nodeImageLightbox, setNodeImageLightbox] = useState<KonvaNodeImageLightboxState | null>(null)
  const [dropHintKind, setDropHintKind] = useState<'image' | 'pdf' | null>(null)
  const [stage, setStage] = useState<Konva.Stage | null>(null)
  const [contextMenu, setContextMenu] = useState<{ worldX: number; worldY: number; x: number; y: number } | null>(null)
  const [persistedBoardIds, setPersistedBoardIds] = useState<Record<string, true>>(() => (
    initialBoard ? { [boardId]: true } : {}
  ))
  const hasPersistedBoard = Boolean(initialBoard) || Boolean(persistedBoardIds[boardId])
  const [selectionActionError, setSelectionActionError] = useState<string | null>(null)
  const [aiCreditDialogMessage, setAiCreditDialogMessage] = useState<string | null>(null)
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
    onAiRunCreditError: setAiCreditDialogMessage,
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
    setInteractionShapeIds([])
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
  }, [closeNodeMenu, handleSelectionChange, setTransformPreview])
  const { shellProps, transientUiProps } = useKonvaCanvasSpikeRuntime({
    autoLoadBoard,
    boardId,
    boardTitle,
    boardPageHistoryRef,
    canvasSetters: {
      setAiCreditDialogMessage,
      setCamera,
      setClipboardShapeCount,
      setConnectionPreviewPresence,
      setContextMenu,
      setCropEditingImageId,
      setDocument,
      setDocumentState,
      setDropHintKind,
      setEditingNodeText,
      setEditingTextId,
      setInteractionShapeIds,
      setIsSpacePanning,
      setNextStyle,
      setNodeImageLightbox,
      setPersistedBoardIds,
      setSelectedEdgeId,
      setSelectionActionError,
      setSelectionMarqueeBounds,
      setSettingsOpen,
      setStage,
      setTransformPreview: setTransformPreviewThrottled,
    },
    canvasState: {
      activeToolPreference,
      aiCreditDialogMessage,
      camera,
      connectionPreviewPresence,
      contextMenu,
      cropEditingImageId,
      document,
      dropHintKind,
      editingNodeText,
      editingTextId,
      interactionShapeIds,
      nextStyle,
      nodeImageLightbox,
      selectedEdgeId,
      selectedIds,
      selectionActionError,
      selectionMarqueeBounds,
      settingsOpen,
      stage,
      transformPreview,
    },
    clipboardRef,
    clearTransientState,
    documentChangeBridgeRef,
    handleSelectionChange,
    handleToolChange,
    hasPersistedBoard,
    history,
    imageUploadApi: {
      fileInput,
      promptImageNodeUpload,
      uploadDropFileAtPoint,
    },
    initialBoard,
    interactionLockedRef,
    isSpacePanning,
    lastPastePointRef,
    metrics: { diagnostics, setShellRect, shellRect, size },
    mode,
    nodeMenuApi: {
      cleanChatHistory,
      closeNodeMenu,
      createNodeCard,
      nodeMenu,
      openNodeMenu,
      regenerateChatMessage,
      sendChatMessage,
      setChatModel,
      setNodeField,
      setNodeTextField,
      toggleNodeRun,
    },
    onBoardLoaded,
    onBoardSaved,
    onBoardTitleRename,
    readOnly,
    saveAuditRef,
    themeMode,
    workspace,
    ydoc,
  })

  return (
    <KonvaCanvasShell {...shellProps} shellRef={shellRef}>
      <KonvaCanvasTransientUi {...transientUiProps} />
    </KonvaCanvasShell>
  )
}
