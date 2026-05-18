import type { ComponentProps } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument, CanvasShapeStyle } from '@/features/canvas-engine'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import { KonvaCanvasShell } from './KonvaCanvasShell'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import type { KonvaCollaborationEdgeSession } from './KonvaNodeEdgeLayer'

type ShellProps = ComponentProps<typeof KonvaCanvasShell>
type HeaderProps = ShellProps['headerProps']
type PagesPanelProps = ShellProps['pagesPanelProps']
type SectionHandlers = ShellProps['sectionHandlers']
type WritableStageProps = ShellProps['writableStageProps']
type OverlayProps = ShellProps['overlayProps']

type CreateKonvaCanvasShellPropsOptions = {
  activeTool: KonvaCanvasTool
  addStressStrokes: () => void
  boardId: string
  boardTitle: string
  boardPages: {
    activePageId: string
    pages: PagesPanelProps['pages']
    selectPage: PagesPanelProps['onSelectPage']
  }
  camera: CanvasCamera
  clearCanvas: () => void
  collaboration: HeaderProps['collaboration']
  collaborationEnabled: boolean
  collaborationPageSummaries: HeaderProps['pageSummaries']
  createNodeCard: NonNullable<ShellProps['toolbarProps']>['onCreateNode']
  document: CanvasDocument
  dropHintKind: ShellProps['dropHintKind']
  effectiveReadOnly: boolean
  handleCameraCommit: ShellProps['viewerStageProps']['onCameraCommit']
  handleCameraPreview: ShellProps['viewerStageProps']['onCameraPreview']
  handleCreatePage: PagesPanelProps['onCreatePage']
  handleDeletePage: PagesPanelProps['onDeletePage']
  handleDuplicatePage: PagesPanelProps['onDuplicatePage']
  handleMovePage: PagesPanelProps['onMovePage']
  handleRenamePage: PagesPanelProps['onRenamePage']
  handleSelectionChange: WritableStageProps['onSelectionChange']
  handleStageNodeTextEditStart: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  handleStageReady: (stage: Konva.Stage | null) => void
  handleStageTextEditStart: (shapeId: string) => void
  handleLocalDocumentCommit?: () => void
  handleToolbarOpenSettings: NonNullable<ShellProps['toolbarProps']>['onOpenSettings']
  handleToolChange: NonNullable<ShellProps['toolbarProps']>['onToolChange']
  headerLocalSync: HeaderProps['localSync']
  isSpacePanning: WritableStageProps['isSpacePanning']
  localSyncBannerProps?: ShellProps['localSyncBannerProps']
  mode: 'board' | 'dev'
  nextStyle: CanvasShapeStyle
  onBoardTitleRename?: HeaderProps['onBoardTitleRename']
  overlayOccupancy: OverlayProps['occupancy']
  overlaySessions: OverlayProps['sessions']
  pageLimit?: number | null
  pageLimitPlanName?: string
  remoteEdgeSessions: KonvaCollaborationEdgeSession[]
  remotePresenceSessions: BoardCollaborationSessionRecord[]
  remoteLockedShapeOwnerById?: WritableStageProps['remoteLockedShapeOwnerById']
  requestFocusedEdit: (shapeId: string, targetLabel: string) => boolean
  selectionExportCaptureMode: WritableStageProps['captureMode']
  sendGeneratedOutputToCanvas: WritableStageProps['onGeneratedImageToCanvas']
  sendImageNodeToCanvas: WritableStageProps['onImageNodeToCanvas']
  setConnectionPreviewPresence: WritableStageProps['onConnectionPreviewChange']
  setDraftPreviewPresence: WritableStageProps['onDraftPreviewChange']
  setDocument: WritableStageProps['onDocumentChange']
  setFocusedControlShapeState: WritableStageProps['onNodeFocusedEditStateChange']
  setInteractionShapeIds: WritableStageProps['onInteractionShapeIdsChange']
  setNodeField: WritableStageProps['onNodeFieldChange']
  setSelectionMarqueeBounds: WritableStageProps['onSelectionBoxChange']
  setTransformPreview: WritableStageProps['onTransformPreviewChange']
  settingsOpen: boolean
  size: { height: number; width: number }
  stageDomEvents: {
    handleContextMenu: NonNullable<SectionHandlers['onContextMenu']>
    handleDoubleClick: NonNullable<SectionHandlers['onDoubleClick']>
    handleDragEnter: NonNullable<SectionHandlers['onDragEnter']>
    handleDragLeave: NonNullable<SectionHandlers['onDragLeave']>
    handleDragOver: NonNullable<SectionHandlers['onDragOver']>
    handleDrop: NonNullable<SectionHandlers['onDrop']>
    handlePointerDownCapture: NonNullable<SectionHandlers['onPointerDownCapture']>
    handlePointerLeave: NonNullable<SectionHandlers['onPointerLeave']>
    handlePointerMoveCapture: NonNullable<SectionHandlers['onPointerMoveCapture']>
  }
  stageToolMode: string
  themeMode: string
  toggleNodeRun: WritableStageProps['onNodeRunToggle']
  writableStagePropsExtras: Pick<WritableStageProps,
    'cropEditingImageId'
    | 'editingNodeText'
    | 'editingTextId'
    | 'onEdgeDisconnect'
    | 'onEdgeSelect'
    | 'onHistoryCheckpoint'
    | 'onNodeChatClean'
    | 'onNodeChatModelChange'
    | 'onNodeChatRegenerate'
    | 'onNodeChatSend'
    | 'onNodeChatUpload'
    | 'onNodeImagePreviewOpen'
    | 'pendingImagePastes'
    | 'selectedEdgeId'
    | 'selectedIds'>
}

export function createKonvaCanvasShellProps(options: CreateKonvaCanvasShellPropsOptions): Omit<ShellProps, 'shellRef'> {
  return {
    collaborationEnabled: options.collaborationEnabled,
    dropHintKind: options.dropHintKind,
    effectiveReadOnly: options.effectiveReadOnly,
    headerProps: {
      boardTitle: options.boardTitle,
      collaboration: options.collaboration,
      currentPageId: options.boardPages.activePageId,
      localSync: options.headerLocalSync,
      onBoardTitleRename: options.effectiveReadOnly ? undefined : options.onBoardTitleRename,
      pageSummaries: options.collaborationPageSummaries,
    },
    localSyncBannerProps: options.localSyncBannerProps,
    overlayProps: {
      activePageId: options.boardPages.activePageId,
      camera: options.camera,
      document: options.document,
      occupancy: options.overlayOccupancy,
      pageSummaries: options.collaborationPageSummaries,
      sessions: options.overlaySessions,
      stageHeight: options.size.height,
      stageWidth: options.size.width,
    },
    pagesPanelProps: {
      activeDocument: options.document,
      activePageId: options.boardPages.activePageId,
      onCreatePage: options.handleCreatePage,
      onDeletePage: options.handleDeletePage,
      onDuplicatePage: options.handleDuplicatePage,
      onMovePage: options.handleMovePage,
      onRenamePage: options.handleRenamePage,
      onSelectPage: options.boardPages.selectPage,
      pageLimit: options.pageLimit,
      pageLimitPlanName: options.pageLimitPlanName,
      pages: options.boardPages.pages,
      readOnly: options.effectiveReadOnly,
    },
    sectionHandlers: {
      onContextMenu: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleContextMenu,
      onDoubleClick: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleDoubleClick,
      onDragEnter: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleDragEnter,
      onDragLeave: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleDragLeave,
      onDragOver: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleDragOver,
      onDrop: options.effectiveReadOnly ? undefined : options.stageDomEvents.handleDrop,
      onPointerDownCapture: options.effectiveReadOnly ? undefined : options.stageDomEvents.handlePointerDownCapture,
      onPointerLeave: options.stageDomEvents.handlePointerLeave,
      onPointerMoveCapture: options.collaborationEnabled || !options.effectiveReadOnly ? options.stageDomEvents.handlePointerMoveCapture : undefined,
    },
    stageToolMode: options.stageToolMode,
    themeMode: options.themeMode,
    toolbarProps: options.effectiveReadOnly ? undefined : {
      activeTool: options.activeTool,
      isSettingsOpen: options.settingsOpen,
      onAddStressStrokes: options.addStressStrokes,
      onClear: options.clearCanvas,
      onCreateNode: options.createNodeCard,
      onOpenSettings: options.handleToolbarOpenSettings,
      onToolChange: options.handleToolChange,
    },
    viewerStageProps: {
      activePageId: options.boardPages.activePageId,
      camera: options.camera,
      collaborationPresenceSessions: options.remotePresenceSessions,
      document: options.document,
      height: options.size.height,
      onCameraCommit: options.handleCameraCommit,
      onCameraPreview: options.handleCameraPreview,
      onStageReady: options.handleStageReady,
      width: options.size.width,
    },
    writableStageProps: {
      activeTool: options.activeTool,
      activePageId: options.boardPages.activePageId,
      camera: options.camera,
      captureMode: options.selectionExportCaptureMode,
      collaborationSessions: options.remoteEdgeSessions,
      collaborationPresenceSessions: options.remotePresenceSessions,
      cropEditingImageId: options.writableStagePropsExtras.cropEditingImageId,
      editingNodeText: options.writableStagePropsExtras.editingNodeText,
      editingTextId: options.writableStagePropsExtras.editingTextId,
      document: options.document,
      height: options.size.height,
      isSpacePanning: options.isSpacePanning,
      nextStyle: options.nextStyle,
      onCameraCommit: options.handleCameraCommit,
      onCameraPreview: options.handleCameraPreview,
      onConnectionPreviewChange: options.setConnectionPreviewPresence,
      onDocumentChange: options.setDocument,
      onDocumentPreview: options.setDocument,
      onDraftPreviewChange: options.setDraftPreviewPresence,
      onEdgeDisconnect: options.writableStagePropsExtras.onEdgeDisconnect,
      onEdgeSelect: options.writableStagePropsExtras.onEdgeSelect,
      onGeneratedImageToCanvas: options.sendGeneratedOutputToCanvas,
      onHistoryCheckpoint: options.writableStagePropsExtras.onHistoryCheckpoint,
      onLocalDocumentCommit: options.handleLocalDocumentCommit,
      onImageNodeToCanvas: options.sendImageNodeToCanvas,
      onInteractionShapeIdsChange: options.setInteractionShapeIds,
      onNodeChatClean: options.writableStagePropsExtras.onNodeChatClean,
      onNodeChatModelChange: options.writableStagePropsExtras.onNodeChatModelChange,
      onNodeChatRegenerate: options.writableStagePropsExtras.onNodeChatRegenerate,
      onNodeChatSend: options.writableStagePropsExtras.onNodeChatSend,
      onNodeChatUpload: options.writableStagePropsExtras.onNodeChatUpload,
      onNodeFieldChange: options.setNodeField,
      onNodeFocusedEditRequest: (shapeId, source) => options.requestFocusedEdit(shapeId, source === 'chat-model-menu' ? 'chat menu' : 'field'),
      onNodeFocusedEditStateChange: options.setFocusedControlShapeState,
      onNodeImagePreviewOpen: options.writableStagePropsExtras.onNodeImagePreviewOpen,
      onNodeRunToggle: options.toggleNodeRun,
      onNodeTextEditStart: options.handleStageNodeTextEditStart,
      onSelectionBoxChange: options.setSelectionMarqueeBounds,
      onSelectionChange: options.handleSelectionChange,
      onStageReady: options.handleStageReady,
      onTextEditStart: options.handleStageTextEditStart,
      onToolChange: options.handleToolChange,
      onTransformPreviewChange: options.setTransformPreview,
      pendingImagePastes: options.writableStagePropsExtras.pendingImagePastes,
      remoteLockedShapeOwnerById: options.remoteLockedShapeOwnerById,
      selectedEdgeId: options.writableStagePropsExtras.selectedEdgeId,
      selectedIds: options.writableStagePropsExtras.selectedIds,
      width: options.size.width,
    },
  }
}
