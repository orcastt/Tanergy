import type { KonvaEventObject } from 'konva/lib/Node'
import { Fragment } from 'react'
import { Circle, Group, Line, Path, Rect } from 'react-konva'
import { boundsToRect, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { getSelectedShapeBounds } from './konvaSelectionUtils'

type KonvaSelectionOverlayProps = {
  selectedBoundsOverride?: CanvasBounds | null
  selectionBox: CanvasBounds | null
  selectedIds: string[]
  shapes: CanvasShape[]
  zoom: number
  onResizeStart: (shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  onRotateStart: (shapeId: string, event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaSelectionOverlay({
  onResizeStart,
  onRotateStart,
  selectedBoundsOverride,
  selectedIds,
  selectionBox,
  shapes,
  zoom,
}: KonvaSelectionOverlayProps) {
  const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id))
  const selectedBounds = selectedBoundsOverride ?? (selectedShapes.length > 0 ? getSelectedShapeBounds(shapes, selectedIds) : null)
  const canResize = selectedShapes.length > 0
  const onlySelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null
  const singleBoxShape = onlySelectedShape && isBoxCanvasShape(onlySelectedShape) && !selectedBoundsOverride ? onlySelectedShape : null
  const showUnionBox = Boolean(selectedBoundsOverride) || selectedIds.length > 1

  return (
    <>
      {selectionBox ? <SelectionRect bounds={selectionBox} zoom={zoom} /> : null}
      {selectedBounds && showUnionBox ? (
        <SelectionRect bounds={selectedBounds} isSelection zoom={zoom} />
      ) : null}
      {singleBoxShape ? (
        <SingleShapeControls
          onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
          onRotateStart={(event) => onRotateStart(singleBoxShape.id, event)}
          shape={singleBoxShape}
          zoom={zoom}
        />
      ) : selectedBounds && canResize ? (
        <ResizeHandles
          bounds={selectedBounds}
          onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
          zoom={zoom}
        />
      ) : null}
    </>
  )
}

function SingleShapeControls({
  onResizeStart,
  onRotateStart,
  shape,
  zoom,
}: {
  shape: Extract<CanvasShape, { props: { height: number; width: number } }>
  onResizeStart: (handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  onRotateStart: (event: KonvaEventObject<PointerEvent>) => void
  zoom: number
}) {
  const width = shape.props.width
  const height = shape.props.height
  const bounds = { maxX: width / 2, maxY: height / 2, minX: -width / 2, minY: -height / 2 }
  return (
    <Group rotation={shape.rotation ?? 0} x={shape.x + width / 2} y={shape.y + height / 2}>
      <SelectionRect bounds={bounds} isSelection zoom={zoom} />
      <ResizeHandles bounds={bounds} onResizeStart={onResizeStart} zoom={zoom} />
      <RotateHandle onRotateStart={onRotateStart} x={width / 2 + 24 / zoom} y={-height / 2 - 24 / zoom} zoom={zoom} />
    </Group>
  )
}

function SelectionRect({ bounds, isSelection = false, zoom }: { bounds: CanvasBounds; isSelection?: boolean; zoom: number }) {
  const rect = boundsToRect(bounds)
  return (
    <Rect
      dash={isSelection ? undefined : [5 / zoom, 4 / zoom]}
      fill={isSelection ? 'transparent' : 'rgba(107, 92, 255, 0.08)'}
      height={rect.height}
      listening={false}
      stroke="#6b5cff"
      strokeWidth={1.2 / zoom}
      width={rect.width}
      x={rect.x}
      y={rect.y}
    />
  )
}

function RotateHandle({
  onRotateStart,
  x,
  y,
  zoom,
}: {
  onRotateStart: (event: KonvaEventObject<PointerEvent>) => void
  x: number
  y: number
  zoom: number
}) {
  const hitRadius = Math.max(11, 15 / zoom)
  const size = 15 / zoom
  return (
    <Group x={x} y={y}>
      <Circle fill="rgba(107, 92, 255, 0.001)" onPointerDown={onRotateStart} radius={hitRadius} />
      <Path data={`M ${-size / 2} 0 A ${size / 2} ${size / 2} 0 1 1 ${size / 4} ${-size / 2}`} listening={false} stroke="#6b5cff" strokeLinecap="round" strokeWidth={1.4 / zoom} />
      <Line closed fill="#6b5cff" listening={false} points={[size / 4, -size / 2, size / 2, -size / 2, size / 2, -size / 4]} />
    </Group>
  )
}

function ResizeHandles({
  bounds,
  onResizeStart,
  zoom,
}: {
  bounds: CanvasBounds
  onResizeStart: (handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  zoom: number
}) {
  const visibleRadius = Math.max(4.5, 5.5 / zoom)
  const hitRadius = Math.max(10, 13 / zoom)
  return (
    <>
      {[
        ['nw', bounds.minX, bounds.minY],
        ['ne', bounds.maxX, bounds.minY],
        ['se', bounds.maxX, bounds.maxY],
        ['sw', bounds.minX, bounds.maxY],
      ].map(([handle, x, y]) => (
        <Fragment key={handle}>
          <Circle
            fill="rgba(107, 92, 255, 0.001)"
            onPointerDown={(event) => onResizeStart(handle as KonvaResizeHandle, event)}
            radius={hitRadius}
            x={x as number}
            y={y as number}
          />
          <Circle
            fill="#ffffff"
            listening={false}
            radius={visibleRadius}
            stroke="#6b5cff"
            strokeWidth={1.2 / zoom}
            x={x as number}
            y={y as number}
          />
        </Fragment>
      ))}
    </>
  )
}
