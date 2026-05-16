'use client'

import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import type Konva from 'konva'
import { screenToWorld, type CanvasCamera, type CanvasDocument, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { runKonvaContextAction } from './konvaContextActions'
import { removeKonvaRuntimeEdge } from './konvaRuntimeEdges'
import { useKonvaCanvasShortcuts } from './useKonvaCanvasShortcuts'
import type { useKonvaBoardPages } from './useKonvaBoardPages'

type UseKonvaCanvasCommandActionsOptions = {
  boardPages: Pick<ReturnType<typeof useKonvaBoardPages>, 'activePageId' | 'updatePageDocument'>
  camera: CanvasCamera
  clipboardRef: MutableRefObject<CanvasShape[]>
  closeNodeMenu: () => void
  contextMenu: { worldX: number; worldY: number; x: number; y: number } | null
  document: CanvasDocument
  effectiveReadOnly: boolean
  handleMoveSelectionToPage: (targetPageId: string) => void
  history: {
    checkpoint: (document?: CanvasDocument) => void
    redo: () => void
    undo: () => void
  }
  lastPastePointRef: RefObject<CanvasPoint | null>
  localYjsSync: {
    canRedo: boolean
    canUndo: boolean
    hasUnsyncedLocalChanges: boolean
    redoLocalChange: () => void
    undoLocalChange: () => void
  }
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onImagePasteComplete: (pendingId: string) => void
  onImagePasteStateChange: (state: KonvaPendingImagePaste) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
  selectedEdgeId: string | null
  selectedIds: string[]
  selectionExport: {
    handleCopySelectionPng: () => Promise<void>
    handleCopySelectionSvg: () => Promise<void>
    handleExportSelectionPng: () => Promise<void>
    handleExportSelectionSvg: () => void
    handleStageReady: (stage: Konva.Stage | null) => void
  }
  setClipboardShapeCount: Dispatch<SetStateAction<number>>
  setContextMenu: Dispatch<SetStateAction<{ worldX: number; worldY: number; x: number; y: number } | null>>
  setIsSpacePanning: Dispatch<SetStateAction<boolean>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setStage: Dispatch<SetStateAction<Konva.Stage | null>>
  size: { height: number; width: number }
  workspace?: TangentWorkspace
}

export function useKonvaCanvasCommandActions({
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
  onDocumentChange,
  onImagePasteComplete,
  onImagePasteStateChange,
  onSelectionChange,
  onToolChange,
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
}: UseKonvaCanvasCommandActionsOptions) {
  const handleUndoShortcut = useCallback(() => {
    if (localYjsSync.hasUnsyncedLocalChanges || !localYjsSync.canUndo) {
      history.undo()
      return
    }
    localYjsSync.undoLocalChange()
  }, [history, localYjsSync])

  const handleRedoShortcut = useCallback(() => {
    if (localYjsSync.hasUnsyncedLocalChanges || !localYjsSync.canRedo) {
      history.redo()
      return
    }
    localYjsSync.redoLocalChange()
  }, [history, localYjsSync])

  const handleStageReady = useCallback((nextStage: Konva.Stage | null) => {
    if (!effectiveReadOnly) selectionExport.handleStageReady(nextStage)
    setStage(nextStage)
  }, [effectiveReadOnly, selectionExport, setStage])

  useKonvaCanvasShortcuts({
    clipboardRef,
    document,
    enabled: !effectiveReadOnly,
    getActivePageId: () => boardPages.activePageId,
    getPastePoint: () => lastPastePointRef.current ?? screenToWorld({ x: size.width / 2, y: size.height / 2 }, camera),
    history,
    onClipboardChange: setClipboardShapeCount,
    onCopySelectionSvg: () => { void selectionExport.handleCopySelectionSvg() },
    onDocumentChange,
    onEdgeSelectionChange: setSelectedEdgeId,
    onImagePasteComplete,
    onImagePasteStateChange,
    onPageDocumentChange: boardPages.updatePageDocument,
    onPanningChange: setIsSpacePanning,
    onRedo: handleRedoShortcut,
    onSelectionChange,
    onToolChange,
    onUndo: handleUndoShortcut,
    pageId: boardPages.activePageId,
    selectedEdgeId,
    selectedIds,
    workspace,
  })

  const runContextAction = useCallback((action: KonvaContextMenuAction) => {
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
      getActivePageId: () => boardPages.activePageId,
      history,
      onClipboardChange: setClipboardShapeCount,
      onDocumentChange,
      onImagePasteComplete,
      onImagePasteStateChange,
      onPageDocumentChange: boardPages.updatePageDocument,
      onSelectionChange,
      pageId: boardPages.activePageId,
      pastePoint,
      selectedIds,
      workspace,
    })
  }, [
    boardPages,
    clipboardRef,
    contextMenu,
    document,
    handleMoveSelectionToPage,
    history,
    onDocumentChange,
    onImagePasteComplete,
    onImagePasteStateChange,
    onSelectionChange,
    selectedIds,
    selectionExport,
    setClipboardShapeCount,
    setContextMenu,
    workspace,
  ])

  const handleToolbarOpenSettings = useCallback(() => {
    closeNodeMenu()
    setSettingsOpen((open) => !open)
  }, [closeNodeMenu, setSettingsOpen])

  const handleEdgeDisconnect = useCallback((edgeId: string) => {
    history.checkpoint(document)
    onDocumentChange((current) => removeKonvaRuntimeEdge(current, edgeId))
    setSelectedEdgeId(null)
  }, [document, history, onDocumentChange, setSelectedEdgeId])

  const handleEdgeSelect = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId)
    onSelectionChange([])
  }, [onSelectionChange, setSelectedEdgeId])

  return {
    handleEdgeDisconnect,
    handleEdgeSelect,
    handleStageReady,
    handleToolbarOpenSettings,
    runContextAction,
  }
}
