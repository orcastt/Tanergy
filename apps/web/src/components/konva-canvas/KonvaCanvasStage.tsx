import type Konva from 'konva'
import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { Group, Layer, Rect, Stage } from 'react-konva'
import type { CanvasCamera, CanvasDocument, CanvasNodeShape, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaEraserTrail } from './KonvaEraserTrail'
import { KonvaFrameChrome } from './KonvaFrameChrome'
import { KonvaNodeEdgeLayer } from './KonvaNodeEdgeLayer'
import { KonvaSelectionOverlay } from './KonvaSelectionOverlay'
import { useKonvaCanvasInteractions } from './useKonvaCanvasInteractions'
import { canKonvaShapeDragWithTool, canKonvaShapeSelectWithTool } from './konvaShapeCapabilities'
import { konvaCaptureExcludeName } from './konvaSelectionExport'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

type KonvaCanvasStageProps = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  captureMode?: boolean
  document: CanvasDocument
  height: number
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  cropEditingImageId?: string | null
  selectedEdgeId: string | null
  selectedIds: string[]
  width: number
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onEdgeDisconnect: (edgeId: string) => void
  onEdgeSelect: (edgeId: string | null) => void
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onImageNodeToCanvas: (shapeId: string) => void
  onNodeFieldChange: (shapeId: string, fieldName: string, value: string | number) => void
  onNodeRunToggle: (shapeId: string) => void
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
  const shapesAreInteractive = !props.captureMode && props.activeTool !== 'hand' && props.activeTool !== 'eraser'
  const canDragShape = shapesAreInteractive && !props.isSpacePanning
  const frameIds = new Set(props.document.shapes.filter((shape) => shape.type === 'frame').map((shape) => shape.id))
  const frameChildren = getFrameChildren(props.document.shapes, frameIds)
  const draggingIds = new Set(draggingShapeIds)
  const overlayShapes = dragPreviewShapes ? mergeShapes(props.document.shapes, dragPreviewShapes) : props.document.shapes
  const nodeShapes = overlayShapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')

  const renderShapeNode = (shape: CanvasShape) => (
    <KonvaCanvasShape
      interactive={canInteractWithShape(shape, props.activeTool, shapesAreInteractive)}
      isSelected={!props.captureMode && props.selectedIds.length === 1 && props.selectedIds.includes(shape.id)}
      key={shape.id}
      onDragMove={handleShapeDragMove}
      onDragEnd={handleShapeDragEnd}
      onDragStart={handleShapeDragStart}
      onDoubleClick={props.onTextEditStart}
      onImageNodeToCanvas={props.onImageNodeToCanvas}
      onNodeFieldChange={props.onNodeFieldChange}
      onNodePortPointerDown={handleNodePortPointerDown}
      onNodeRunToggle={props.onNodeRunToggle}
      onSelect={handleShapeSelect}
      panMode={props.isSpacePanning}
      selectable={canSelectShapeWithTool(shape, props.activeTool)}
      shape={shape}
      toolAllowsDrag={canDragShape && canDragShapeWithTool(shape, props.activeTool)}
      zoom={renderCamera.zoom}
    />
  )
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
          <Rect
            fill="rgba(255,255,255,0.01)"
            height={props.height / renderCamera.zoom}
            width={props.width / renderCamera.zoom}
            x={-renderCamera.x / renderCamera.zoom}
            y={-renderCamera.y / renderCamera.zoom}
          />
        </Layer>
      )}

      {props.captureMode ? null : (
        <Layer name={konvaCaptureExcludeName}>
          <KonvaNodeEdgeLayer
            edges={props.document.runtimeEdges}
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
        {props.document.shapes.map((shape) => {
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

      {draft && !props.captureMode ? (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaCanvasShape
            interactive={false}
            isSelected={false}
            onDragMove={handleShapeDragMove}
            onDragEnd={handleShapeDragEnd}
            onDragStart={handleShapeDragStart}
            onDoubleClick={props.onTextEditStart}
            onImageNodeToCanvas={props.onImageNodeToCanvas}
            onNodeFieldChange={props.onNodeFieldChange}
            onSelect={handleShapeSelect}
            onNodeRunToggle={props.onNodeRunToggle}
            panMode={props.isSpacePanning}
            selectable={false}
            shape={draft}
            toolAllowsDrag={false}
            zoom={renderCamera.zoom}
          />
        </Layer>
      ) : null}

      {props.captureMode ? null : (
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
            shapes={overlayShapes}
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
  return true
}

function canSelectShapeWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  return canKonvaShapeSelectWithTool(shape, activeTool)
}

function canDragShapeWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  return canKonvaShapeDragWithTool(shape, activeTool)
}

function mergeShapes(shapes: CanvasShape[], previewShapes: CanvasShape[]) {
  const preview = new Map(previewShapes.map((shape) => [shape.id, shape]))
  const merged = shapes.map((shape) => preview.get(shape.id) ?? shape)
  const existing = new Set(shapes.map((shape) => shape.id))
  return [...merged, ...previewShapes.filter((shape) => !existing.has(shape.id))]
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
