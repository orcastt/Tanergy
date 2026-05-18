import type Konva from 'konva'
import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import { Group, Layer, Stage } from 'react-konva'
import type { CanvasBounds, CanvasCamera, CanvasDocument, CanvasNodeShape, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationSessionRecord,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import { KonvaCanvasBackground } from './KonvaCanvasBackground'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaEraserTrail } from './KonvaEraserTrail'
import { KonvaFrameChrome } from './KonvaFrameChrome'
import { KonvaLocalDraftLayer } from './KonvaLocalDraftLayer'
import { KonvaNodeEdgeLayer, type KonvaCollaborationEdgeSession } from './KonvaNodeEdgeLayer'
import { KonvaPendingImagePasteLayer, type KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'
import { KonvaRemoteDraftLayer } from './KonvaRemoteDraftLayer'
import { KonvaSelectionOverlay } from './KonvaSelectionOverlay'
import { useKonvaCanvasInteractions } from './useKonvaCanvasInteractions'
import { canKonvaShapeDragWithTool, canKonvaShapeSelectWithTool } from './konvaShapeCapabilities'
import { normalizeKonvaShapeMinResizeSize } from './konvaNodeCardSizing'
import { konvaCaptureExcludeName } from './konvaSelectionExport'
import { getVisibleKonvaShapes } from './konvaViewportCulling'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'

type KonvaCanvasStageProps = {
  activeTool: KonvaCanvasTool
  activePageId?: string | null
  camera: CanvasCamera
  captureMode?: boolean
  collaborationSessions?: readonly KonvaCollaborationEdgeSession[]
  collaborationPresenceSessions?: readonly BoardCollaborationSessionRecord[]
  document: CanvasDocument
  height: number
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  pendingImagePastes?: readonly KonvaPendingImagePaste[]
  cropEditingImageId?: string | null
  editingNodeText?: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingTextId?: string | null
  remoteLockedShapeOwnerById?: ReadonlyMap<string, string>
  selectedEdgeId: string | null
  selectedIds: string[]
  width: number
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onConnectionPreviewChange?: (preview: BoardCollaborationConnectionPreview | null) => void
  onDraftPreviewChange?: (shape: CanvasShape | null) => void
  onEdgeDisconnect: (edgeId: string) => void
  onEdgeSelect: (edgeId: string | null) => void
  onGeneratedImageToCanvas: (input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => void
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onLocalDocumentCommit?: () => void
  onImageNodeToCanvas: (shapeId: string) => void
  onNodeImagePreviewOpen: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void
  onNodeChatClean: (shapeId: string) => void
  onNodeChatRegenerate: (shapeId: string, messageId: string) => void
  onNodeChatModelChange: (shapeId: string, modelId: string) => void
  onNodeChatSend: (shapeId: string, draftOverride?: string) => void
  onNodeChatUpload: (shapeId: string) => void
  onNodeFieldChange: (shapeId: string, fieldName: string, value: string | number) => void
  onNodeFocusedEditRequest?: (shapeId: string, source: 'chat-model-menu' | 'field-dropdown') => boolean
  onNodeFocusedEditStateChange?: (
    shapeId: string,
    source: 'chat-model-menu' | 'field-dropdown',
    active: boolean,
  ) => void
  onNodeRunToggle: (shapeId: string) => void
  onNodeTextEditStart: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  onInteractionShapeIdsChange?: (shapeIds: string[]) => void
  onSelectionBoxChange?: (bounds: CanvasBounds | null) => void
  onTransformPreviewChange?: (preview: { bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null) => void
  onSelectionChange: (shapeIds: string[]) => void
  onStageReady?: (stage: Konva.Stage | null) => void
  onTextEditStart: (shapeId: string) => void
  onToolChange: (tool: KonvaCanvasTool) => void
}

export function KonvaCanvasStage(props: KonvaCanvasStageProps) {
  const {
    draft,
    eraserTrail,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleLineEndpointStart,
    handleLineRouteHandleStart,
    handleImageCropStart,
    handleNodePortPointerDown,
    handleResizeStart,
    handleRotateStart,
    handleShapeDragMove,
    handleShapeDragEnd,
    handleShapeDragStart,
    handleShapeSelect,
    handleWheel,
    dragPreviewShapes,
    draggingShapeIds,
    runtimeConnectionPreview,
    selectedBoundsOverride,
    selectionBox,
    snapGuides,
    stageRef,
  } = useKonvaCanvasInteractions(props)
  const renderCamera = props.camera
  const selectionMode = props.activeTool === 'select'
  const shapesAreInteractive = !props.captureMode && selectionMode
  const canDragShape = shapesAreInteractive && !props.isSpacePanning
  const sourceShapes = useMemo(() => (dragPreviewShapes ?? props.document.shapes).map(normalizeKonvaShapeMinResizeSize), [dragPreviewShapes, props.document.shapes])
  const renderShapes = getVisibleKonvaShapes({
    camera: renderCamera,
    captureMode: props.captureMode,
    cropEditingImageId: props.cropEditingImageId,
    draggingShapeIds,
    height: props.height,
    selectedIds: props.selectedIds,
    shapes: sourceShapes,
    width: props.width,
  })
  const frameIds = new Set(renderShapes.filter((shape) => shape.type === 'frame').map((shape) => shape.id))
  const frameChildren = getFrameChildren(renderShapes, frameIds)
  const draggingIds = new Set(draggingShapeIds)
  const nodeShapes = renderShapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')

  const renderShapeNode = (shape: CanvasShape) => {
    const remotelyLocked = Boolean(props.remoteLockedShapeOwnerById?.has(shape.id))
    return (
      <KonvaCanvasShape
      document={props.document}
      editingNodeTextField={props.editingNodeText?.shapeId === shape.id ? props.editingNodeText.fieldName : null}
      hideEditableText={props.editingTextId === shape.id}
      directDrag={props.activeTool === 'select'}
      interactive={canInteractWithShape(shape, props.activeTool, shapesAreInteractive)}
      isDragSelected={props.selectedIds.includes(shape.id)}
      isSelected={!props.captureMode && props.selectedIds.length === 1 && props.selectedIds.includes(shape.id)}
      key={shape.id}
      onDragMove={handleShapeDragMove}
      onDragEnd={handleShapeDragEnd}
      onDragStart={handleShapeDragStart}
      onDoubleClick={props.onTextEditStart}
      onGeneratedImageToCanvas={props.onGeneratedImageToCanvas}
      onImageNodeToCanvas={props.onImageNodeToCanvas}
      onNodeImagePreviewOpen={props.onNodeImagePreviewOpen}
      onNodeChatClean={props.onNodeChatClean}
      onNodeChatRegenerate={props.onNodeChatRegenerate}
      onNodeChatModelChange={props.onNodeChatModelChange}
      onNodeChatSend={props.onNodeChatSend}
      onNodeChatUpload={props.onNodeChatUpload}
      onNodeFieldChange={props.onNodeFieldChange}
      onNodeFocusedEditRequest={props.onNodeFocusedEditRequest}
      onNodeFocusedEditStateChange={props.onNodeFocusedEditStateChange}
      onNodePortPointerDown={handleNodePortPointerDown}
      onNodeRunToggle={props.onNodeRunToggle}
      onNodeTextEditStart={props.onNodeTextEditStart}
      onSelect={handleShapeSelect}
      panMode={props.isSpacePanning}
      previewMode={false}
      remotelyLocked={remotelyLocked}
      selectable={canSelectShapeWithTool(shape, props.activeTool)}
      shape={shape}
      toolAllowsDrag={canDragShape && canDragShapeWithTool(shape, props.activeTool) && !remotelyLocked}
      zoom={renderCamera.zoom}
      />
    )
  }
  const onStageReady = props.onStageReady
  const setStageRef = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage
    onStageReady?.(stage)
  }, [onStageReady, stageRef])

  return (
    <Stage
      height={props.height}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={setStageRef}
      width={props.width}
    >
      {props.captureMode ? null : (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaCanvasBackground camera={renderCamera} height={props.height} width={props.width} />
        </Layer>
      )}

      {props.captureMode ? null : (
        <Layer>
          <KonvaNodeEdgeLayer
            collaborationSessions={props.collaborationSessions}
            edges={props.document.runtimeEdges}
            interactive={selectionMode}
            onEdgeDisconnect={props.onEdgeDisconnect}
            onEdgeSelect={props.onEdgeSelect}
            preview={runtimeConnectionPreview}
            selectedEdgeId={props.selectedEdgeId}
            shapes={nodeShapes}
            zoom={renderCamera.zoom}
          />
        </Layer>
      )}

      <Layer>
        {renderShapes.map((shape) => {
          if (shape.parentId && frameIds.has(shape.parentId)) return null
          if (shape.type !== 'frame') return renderShapeNode(shape)
          return (
            <Group key={shape.id}>
              {renderShapeNode(shape)}
              <Group clipFunc={(context) => {
                context.rect(shape.x, shape.y, shape.props.width, shape.props.height)
              }}>
                {(frameChildren.get(shape.id) ?? []).map(renderShapeNode)}
              </Group>
              {draggingIds.has(shape.id) || props.captureMode ? null : <KonvaFrameChrome frame={shape} />}
            </Group>
          )
        })}
      </Layer>

      {props.captureMode || !props.collaborationPresenceSessions || props.collaborationPresenceSessions.length === 0 ? null : (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaRemoteDraftLayer
            activePageId={props.activePageId}
            document={props.document}
            sessions={props.collaborationPresenceSessions}
            zoom={renderCamera.zoom}
          />
        </Layer>
      )}

      {draft && !props.captureMode ? (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaLocalDraftLayer
            document={props.document}
            draft={draft}
            panMode={props.isSpacePanning}
            zoom={renderCamera.zoom}
          />
        </Layer>
      ) : null}

      {props.captureMode || !props.pendingImagePastes || props.pendingImagePastes.length === 0 ? null : (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaPendingImagePasteLayer items={props.pendingImagePastes} />
        </Layer>
      )}

      {props.captureMode || !selectionMode ? null : (
        <Layer name={konvaCaptureExcludeName}>
          <KonvaSelectionOverlay
            cropEditingImageId={props.cropEditingImageId}
            onImageCropStart={handleImageCropStart}
            onLineEndpointStart={handleLineEndpointStart}
            onLineRouteHandleStart={handleLineRouteHandleStart}
            onResizeStart={handleResizeStart}
            onRotateStart={handleRotateStart}
            selectedBoundsOverride={selectedBoundsOverride}
            selectedIds={props.selectedIds}
            selectionBox={selectionBox}
            shapes={renderShapes}
            snapGuides={snapGuides}
            zoom={renderCamera.zoom}
          />
        </Layer>
      )}

      {props.captureMode ? null : (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaEraserTrail points={eraserTrail} zoom={renderCamera.zoom} />
        </Layer>
      )}
    </Stage>
  )
}

function canInteractWithShape(shape: CanvasShape, activeTool: KonvaCanvasTool, defaultInteractive: boolean) {
  if (!defaultInteractive) return false
  if (activeTool !== 'select') return false
  return true
}

function canSelectShapeWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  return canKonvaShapeSelectWithTool(shape, activeTool)
}

function canDragShapeWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  return canKonvaShapeDragWithTool(shape, activeTool)
}

function getFrameChildren(shapes: CanvasShape[], frameIds: Set<string>) {
  const children = new Map<string, CanvasShape[]>()
  for (const shape of shapes) {
    if (!shape.parentId || !frameIds.has(shape.parentId)) continue
    const current = children.get(shape.parentId) ?? []
    current.push(shape)
    children.set(shape.parentId, current)
  }
  return children
}
