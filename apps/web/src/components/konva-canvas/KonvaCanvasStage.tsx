import { type Dispatch, type SetStateAction } from 'react'
import { Layer, Rect, Stage } from 'react-konva'
import type { CanvasCamera, CanvasDocument, CanvasShapeStyle } from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaEraserTrail } from './KonvaEraserTrail'
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
}

export function KonvaCanvasStage(props: KonvaCanvasStageProps) {
  const {
    draft,
    eraserTrail,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleResizeStart,
    handleShapeDragMove,
    handleShapeDragEnd,
    handleShapeDragStart,
    handleShapeSelect,
    handleWheel,
    selectedBoundsOverride,
    selectionBox,
    stageRef,
  } = useKonvaCanvasInteractions(props)
  const renderCamera = props.camera
  const shapesAreInteractive = props.activeTool !== 'hand' && props.activeTool !== 'eraser'
  const canDragShape = props.activeTool === 'select' && !props.isSpacePanning

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
        {props.document.shapes.map((shape) => (
          <KonvaCanvasShape
            interactive={shapesAreInteractive}
            isSelected={props.selectedIds.length === 1 && props.selectedIds.includes(shape.id)}
            key={shape.id}
            onDragMove={handleShapeDragMove}
            onDragEnd={handleShapeDragEnd}
            onDragStart={handleShapeDragStart}
            onSelect={handleShapeSelect}
            panMode={props.isSpacePanning}
            shape={shape}
            toolAllowsDrag={canDragShape}
            zoom={renderCamera.zoom}
          />
        ))}
      </Layer>

      {draft ? (
        <Layer listening={false}>
          <KonvaCanvasShape
            interactive={false}
            isSelected={false}
            onDragMove={handleShapeDragMove}
            onDragEnd={handleShapeDragEnd}
            onDragStart={handleShapeDragStart}
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
          onResizeStart={handleResizeStart}
          selectedBoundsOverride={selectedBoundsOverride}
          selectedIds={props.selectedIds}
          selectionBox={selectionBox}
          shapes={props.document.shapes}
          zoom={renderCamera.zoom}
        />
      </Layer>

      <Layer listening={false}>
        <KonvaEraserTrail points={eraserTrail} zoom={renderCamera.zoom} />
      </Layer>
    </Stage>
  )
}
