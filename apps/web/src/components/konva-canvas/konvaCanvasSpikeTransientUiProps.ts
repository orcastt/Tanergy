'use client'

import type { ComponentProps, Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument, CanvasShapeStyle } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import { KonvaCanvasShell } from './KonvaCanvasShell'
import { KonvaCanvasTransientUi } from './KonvaCanvasTransientUi'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import type { KonvaNodeImageLightboxState } from './KonvaNodeImageLightbox'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

type ShellProps = Omit<ComponentProps<typeof KonvaCanvasShell>, 'shellRef'>
type TransientUiProps = ComponentProps<typeof KonvaCanvasTransientUi>

export type CreateSpikeTransientUiPropsOptions = {
  activePageId: string
  activeTool: KonvaCanvasTool
  autoLoadBoard: boolean
  boardId: string
  boardTitle: string
  camera: CanvasCamera
  canCaptureSelection: boolean
  canConvertImageToNode: boolean
  canCropImage: boolean
  canGroupSelection: boolean
  canLockSelection: boolean
  canRemoveBackground: boolean
  canStartObjectCutout: boolean
  canUngroupSelection: boolean
  canUnlockSelection: boolean
  contextMenu: { worldX: number; worldY: number; x: number; y: number } | null
  convertImageToNode: () => void
  createNodeCard: (type: Parameters<NonNullable<ShellProps['toolbarProps']>['onCreateNode']>[0], point: { x: number; y: number }) => void
  cropImage: () => void
  diagnostics: ComponentProps<typeof KonvaCanvasTransientUi>['diagnosticsProps']['diagnostics']
  document: CanvasDocument
  editingNodeText: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingNodeTextShape: NonNullable<TransientUiProps['nodeTextEditorProps']>['shape'] | null
  editingTextShape: NonNullable<TransientUiProps['textEditorProps']>['shape'] | null
  effectiveReadOnly: boolean
  fileInput?: ReactNode
  focusedEditNotice?: string | null
  getPageEnvelope: NonNullable<TransientUiProps['saveAuditProps']>['getPageEnvelope']
  hasPersistedBoard: boolean
  handleCaptureSelectionToImageNode: () => Promise<void>
  handleEditingNodeTextCommit: NonNullable<TransientUiProps['nodeTextEditorProps']>['onCommit']
  handleEditingNodeTextSubmit: NonNullable<TransientUiProps['nodeTextEditorProps']>['onSubmit']
  handleEditingTextCommit: NonNullable<TransientUiProps['textEditorProps']>['onCommit']
  historyClear: () => void
  historyTitle: string
  isCapturingSelection: boolean
  isRemovingBackground: boolean
  lightboxState: KonvaNodeImageLightboxState | null
  mode: 'board' | 'dev'
  navigatorStageHeight: number
  navigatorStageWidth: number
  nextStyle: CanvasShapeStyle
  nodeMenu: { world: { x: number; y: number }; x: number; y: number } | null
  onBoardLoaded: (board: BoardPersistenceSummary) => void
  onBoardSaved: (board: BoardPersistenceSummary) => void
  onCloseLightbox: () => void
  onCloseNodeTextEditor: () => void
  onCloseSettings: () => void
  onCloseTextEditor: () => void
  onCloseContextMenu: () => void
  onContextAction: (action: KonvaContextMenuAction) => void
  onDocumentChange: (updater: SetStateAction<CanvasDocument>) => void
  onDocumentRestore: (restore: Parameters<NonNullable<TransientUiProps['saveAuditProps']>['onDocumentRestore']>[0]) => void
  onGroupSelection: () => void
  onHistoryCheckpoint: () => void
  onLockSelection: () => void
  onNextStyleChange: Dispatch<SetStateAction<CanvasShapeStyle>>
  onRemoveBackground: () => void
  onSelectionChange: (shapeIds: string[]) => void
  onUngroupSelection: () => void
  onUnlockSelection: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  pageRevision: number
  pages: NonNullable<TransientUiProps['contextMenuHostProps']>['pages']
  pointCount: number
  saveAuditRef: RefObject<KonvaBoardSaveAuditHandle | null>
  selectedIds: string[]
  selectionActionError: string | null
  settingsOpen: boolean
  shellRect: DOMRect | null
  size: { height: number; width: number }
  stage: Konva.Stage | null
  workspace?: TangentWorkspace
  zoom: number
}

export function createKonvaCanvasSpikeTransientUiProps({
  activePageId,
  activeTool,
  autoLoadBoard,
  boardId,
  boardTitle,
  camera,
  canCaptureSelection,
  canConvertImageToNode,
  canCropImage,
  canGroupSelection,
  canLockSelection,
  canRemoveBackground,
  canStartObjectCutout,
  canUngroupSelection,
  canUnlockSelection,
  contextMenu,
  convertImageToNode,
  createNodeCard,
  cropImage,
  diagnostics,
  document,
  editingNodeText,
  editingNodeTextShape,
  editingTextShape,
  effectiveReadOnly,
  fileInput,
  focusedEditNotice,
  getPageEnvelope,
  hasPersistedBoard,
  handleCaptureSelectionToImageNode,
  handleEditingNodeTextCommit,
  handleEditingNodeTextSubmit,
  handleEditingTextCommit,
  historyClear,
  historyTitle,
  isCapturingSelection,
  isRemovingBackground,
  lightboxState,
  mode,
  navigatorStageHeight,
  navigatorStageWidth,
  nextStyle,
  nodeMenu,
  onBoardLoaded,
  onBoardSaved,
  onCloseContextMenu,
  onCloseLightbox,
  onCloseNodeTextEditor,
  onCloseSettings,
  onCloseTextEditor,
  onContextAction,
  onDocumentChange,
  onDocumentRestore,
  onGroupSelection,
  onHistoryCheckpoint,
  onLockSelection,
  onNextStyleChange,
  onRemoveBackground,
  onSelectionChange,
  onUngroupSelection,
  onUnlockSelection,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  pageRevision,
  pages,
  pointCount,
  saveAuditRef,
  selectedIds,
  selectionActionError,
  settingsOpen,
  shellRect,
  size,
  stage,
  workspace,
  zoom,
}: CreateSpikeTransientUiPropsOptions): TransientUiProps {
  return {
    contextMenuHostProps: effectiveReadOnly ? undefined : contextMenu ? {
      activePageId,
      canLockSelection,
      canUnlockSelection,
      contextMenu,
      document,
      height: size.height,
      onAction: onContextAction,
      onClose: onCloseContextMenu,
      pages,
      selectedIds,
      width: size.width,
    } : undefined,
    diagnosticsProps: {
      diagnostics,
      pointCount,
      zoom,
    },
    fileInput: effectiveReadOnly ? null : fileInput,
    focusedEditNotice,
    lightboxKey: lightboxState
      ? `${lightboxState.title}:${lightboxState.batches[0]?.[0]?.assetId ?? 'image'}:${lightboxState.batches.length}`
      : undefined,
    lightboxProps: lightboxState ? {
      onClose: onCloseLightbox,
      state: lightboxState,
    } : undefined,
    navigatorProps: {
      camera,
      document,
      onZoomIn,
      onZoomOut,
      onZoomReset,
      stageHeight: navigatorStageHeight,
      stageWidth: navigatorStageWidth,
    },
    nodeCreateMenuProps: !effectiveReadOnly && nodeMenu ? {
      onCreateNode: (type) => createNodeCard(type, nodeMenu.world),
      style: { left: nodeMenu.x, top: nodeMenu.y },
    } : undefined,
    nodeTextEditorProps: !effectiveReadOnly && editingNodeText && editingNodeTextShape ? {
      camera,
      fieldName: editingNodeText.fieldName,
      onCancel: onCloseNodeTextEditor,
      onCommit: handleEditingNodeTextCommit,
      onSubmit: handleEditingNodeTextSubmit,
      shape: editingNodeTextShape,
    } : undefined,
    propertiesProps: effectiveReadOnly ? undefined : {
      activeTool,
      document,
      nextStyle,
      onDocumentChange,
      onHistoryCheckpoint,
      onNextStyleChange,
      onSelectionChange,
      selectedIds,
    },
    saveAuditProps: effectiveReadOnly ? undefined : {
      ref: saveAuditRef,
      autoLoad: autoLoadBoard,
      boardId,
      boardTitle,
      camera,
      createIfMissing: !hasPersistedBoard,
      document,
      getPageEnvelope,
      activePageId,
      historyTitle,
      mode,
      onBoardLoaded,
      onBoardSaved,
      onDocumentRestore: (restore) => {
        historyClear()
        onDocumentRestore(restore)
      },
      pageRevision,
      stage,
      workspace,
    },
    selectionToolbarProps: effectiveReadOnly ? undefined : {
      actionError: selectionActionError,
      camera,
      canCaptureSelection,
      canConvertImageToNode,
      canCropImage,
      canGroupSelection,
      canLockSelection,
      canRemoveBackground,
      canStartObjectCutout,
      canUngroupSelection,
      canUnlockSelection,
      document,
      isCapturingSelection,
      isRemovingBackground,
      onCaptureSelection: () => { void handleCaptureSelectionToImageNode() },
      onConvertImageToNode: convertImageToNode,
      onCropImage: cropImage,
      onGroupSelection,
      onLockSelection,
      onRemoveBackground,
      onUngroupSelection,
      onUnlockSelection,
      selectedIds,
      shellRect,
    },
    settingsPanelProps: settingsOpen ? {
      boardMode: mode === 'board',
      onClose: onCloseSettings,
    } : undefined,
    textEditorProps: !effectiveReadOnly && editingTextShape ? {
      camera,
      onCancel: onCloseTextEditor,
      onCommit: handleEditingTextCommit,
      shape: editingTextShape,
    } : undefined,
  }
}
