import { type Dispatch, type SetStateAction } from 'react'
import { Group, Layer, Rect, Stage } from 'react-konva'
import type { CanvasCamera, CanvasDocument, CanvasNodeShape, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaEraserTrail } from './KonvaEraserTrail'
import { KonvaFrameChrome } from './KonvaFrameChrome'
import { KonvaNodeEdgeLayer } from './KonvaNodeEdgeLayer'
import { KonvaSelectionOverlay } from './KonvaSelectionOverlay'
import { useKonvaCanvasInteractions } from './useKonvaCanvasInteractions'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

type KonvaCanvasStageProps = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  height: number
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  selectedIds: string[]
  width: number
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
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
  const shapesAreInteractive = props.activeTool !== 'hand' && props.activeTool !== 'eraser'
  const canDragShape = shapesAreInteractive && !props.isSpacePanning
  const frameIds = new Set(props.document.shapes.filter((shape) => shape.type === 'frame').map((shape) => shape.id))
  const frameChildren = getFrameChildren(props.document.shapes, frameIds)
  const draggingIds = new Set(draggingShapeIds)
  const overlayShapes = dragPreviewShapes ? mergeShapes(props.document.shapes, dragPreviewShapes) : props.document.shapes
  const nodeShapes = overlayShapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')

  const renderShapeNode = (shape: CanvasShape) => (
    <KonvaCanvasShape
      interactive={shapesAreInteractive}
      isSelected={props.selectedIds.length === 1 && props.selectedIds.includes(shape.id)}
      key={shape.id}
      onDragMove={handleShapeDragMove}
      onDragEnd={handleShapeDragEnd}
      onDragStart={handleShapeDragStart}
      onDoubleClick={props.onTextEditStart}
      onNodePortPointerDown={handleNodePortPointerDown}
      onSelect={handleShapeSelect}
      panMode={props.isSpacePanning}
      shape={shape}
      toolAllowsDrag={canDragShape}
      zoom={renderCamera.zoom}
    />
  )

  return (
    <Stage
      height={props.height}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={stageRef}
      width={props.width}
    >
      <Layer listening={false}>
        <Rect
          fill="rgba(255,255,255,0.01)"
          height={props.height / renderCamera.zoom}
          width={props.width / renderCamera.zoom}
          x={-renderCamera.x / renderCamera.zoom}
          y={-renderCamera.y / renderCamera.zoom}
        />
      </Layer>

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
              {draggingIds.has(shape.id) ? null : <KonvaFrameChrome frame={shape} />}
            </Group>
          )
        })}
      </Layer>

      <Layer listening={false}>
        <KonvaNodeEdgeLayer
          edges={props.document.runtimeEdges}
          preview={runtimeConnectionPreview}
          shapes={nodeShapes}
          zoom={renderCamera.zoom}
        />
      </Layer>

      {draft ? (
        <Layer listening={false}>
          <KonvaCanvasShape
            interactive={false}
            isSelected={false}
            onDragMove={handleShapeDragMove}
            onDragEnd={handleShapeDragEnd}
            onDragStart={handleShapeDragStart}
            onDoubleClick={props.onTextEditStart}
            onSelect={handleShapeSelect}
            panMode={props.isSpacePanning}
            shape={draft}
            toolAllowsDrag={false}
            zoom={renderCamera.zoom}
          />
        </Layer>
      ) : null}

      <Layer>
        <KonvaSelectionOverlay
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

      <Layer listening={false}>
        <KonvaEraserTrail points={eraserTrail} zoom={renderCamera.zoom} />
      </Layer>
    </Stage>
  )
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
