import type { KonvaEventObject } from 'konva/lib/Node'
import { Fragment } from 'react'
import { Circle, Group, Line, Path, Rect } from 'react-konva'
import { boundsToRect, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle, KonvaResizeHandle } from './konvaCanvasTypes'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { getSelectedShapeBounds } from './konvaSelectionUtils'
import type { KonvaSnapGuide } from './konvaSnapping'

type KonvaSelectionOverlayProps = {
  selectedBoundsOverride?: CanvasBounds | null
  selectionBox: CanvasBounds | null
  selectedIds: string[]
  shapes: CanvasShape[]
  snapGuides: KonvaSnapGuide[]
  zoom: number
  onLineEndpointStart: (shapeId: string, endpoint: KonvaLineEndpointHandle, event: KonvaEventObject<PointerEvent>) => void
  onResizeStart: (shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  onRotateStart: (shapeId: string, event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaSelectionOverlay({
  onLineEndpointStart,
  onResizeStart,
  onRotateStart,
  selectedBoundsOverride,
  selectedIds,
  selectionBox,
  shapes,
  snapGuides,
  zoom,
}: KonvaSelectionOverlayProps) {
  const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id))
  const selectedBounds = selectedBoundsOverride ?? (selectedShapes.length > 0 ? getSelectedShapeBounds(shapes, selectedIds) : null)
  const canResize = selectedShapes.length > 0
  const onlySelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null
  const singleLineShape = onlySelectedShape && (onlySelectedShape.type === 'line' || onlySelectedShape.type === 'arrow') ? onlySelectedShape : null
  const singleBoxShape = onlySelectedShape && isBoxCanvasShape(onlySelectedShape) && !selectedBoundsOverride ? onlySelectedShape : null
  const showUnionBox = Boolean(selectedBoundsOverride) || selectedIds.length > 1

  return (
    <>
      {snapGuides.map((guide, index) => <SnapGuide guide={guide} key={getSnapGuideKey(guide, index)} zoom={zoom} />)}
      {selectionBox ? <SelectionRect bounds={selectionBox} zoom={zoom} /> : null}
      {selectedBounds && showUnionBox ? (
        <SelectionRect bounds={selectedBounds} isSelection zoom={zoom} />
      ) : null}
      {singleLineShape && !selectedBoundsOverride ? (
        <LineEndpointControls
          onEndpointStart={(endpoint, event) => onLineEndpointStart(singleLineShape.id, endpoint, event)}
          shape={singleLineShape}
          zoom={zoom}
        />
      ) : singleBoxShape ? (
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

function LineEndpointControls({
  onEndpointStart,
  shape,
  zoom,
}: {
  shape: Extract<CanvasShape, { type: 'arrow' | 'line' }>
  onEndpointStart: (endpoint: KonvaLineEndpointHandle, event: KonvaEventObject<PointerEvent>) => void
  zoom: number
}) {
  const points = [
    { endpoint: 'start' as const, x: shape.x, y: shape.y },
    { endpoint: 'end' as const, x: shape.x + shape.props.end.x, y: shape.y + shape.props.end.y },
  ]
  const visibleRadius = Math.max(4.8, 5.8 / zoom)
  const hitRadius = Math.max(12, 14 / zoom)
  return (
    <>
      {points.map((point) => (
        <Fragment key={point.endpoint}>
          <Circle
            fill="rgba(107, 92, 255, 0.001)"
            onPointerDown={(event) => onEndpointStart(point.endpoint, event)}
            radius={hitRadius}
            x={point.x}
            y={point.y}
          />
          <Circle
            fill="#ffffff"
            listening={false}
            radius={visibleRadius}
            stroke="#6b5cff"
            strokeWidth={1.3 / zoom}
            x={point.x}
            y={point.y}
          />
        </Fragment>
      ))}
    </>
  )
}

function getSnapGuideKey(guide: KonvaSnapGuide, index: number) {
  return guide.orientation === 'rotation'
    ? `rotation-${guide.angle}-${index}`
    : `${guide.orientation}-${guide.position}-${index}`
}

function SnapGuide({ guide, zoom }: { guide: KonvaSnapGuide; zoom: number }) {
  if (guide.orientation === 'rotation') {
    const angle = guide.angle * Math.PI / 180
    const end = {
      x: guide.center.x + Math.cos(angle) * guide.radius,
      y: guide.center.y + Math.sin(angle) * guide.radius,
    }
    return (
      <Line
        dash={[5 / zoom, 5 / zoom]}
        listening={false}
        points={[guide.center.x, guide.center.y, end.x, end.y]}
        stroke="#0ea5e9"
        strokeWidth={1.4 / zoom}
      />
    )
  }
  const points = guide.orientation === 'vertical'
    ? [guide.position, guide.min, guide.position, guide.max]
    : [guide.min, guide.position, guide.max, guide.position]
  return (
    <Line
      dash={[6 / zoom, 5 / zoom]}
      listening={false}
      points={points}
      stroke="#0ea5e9"
      strokeWidth={1.4 / zoom}
    />
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
  const hitRadius = Math.max(14, 18 / zoom)
  const radius = 9 / zoom
  const gap = 3 / zoom
  const arrow = 4.8 / zoom
  const strokeWidth = 2.4 / zoom
  const arcTop = -9 / zoom
  return (
    <Group x={x} y={y}>
      <Circle fill="rgba(107, 92, 255, 0.001)" onPointerDown={onRotateStart} radius={hitRadius} />
      <Circle fill="#ffffff" listening={false} radius={13 / zoom} stroke="rgba(107, 92, 255, 0.2)" strokeWidth={1 / zoom} />
      <Path data={`M ${-radius} ${gap} C ${-radius} ${arcTop} ${radius} ${arcTop} ${radius} ${gap}`} listening={false} stroke="#5b4bdb" strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line closed fill="#5b4bdb" listening={false} points={[-radius, gap, -radius + arrow * 0.98, gap - arrow * 0.25, -radius + arrow * 0.28, gap + arrow * 0.92]} />
      <Line closed fill="#5b4bdb" listening={false} points={[radius, gap, radius - arrow * 0.98, gap - arrow * 0.25, radius - arrow * 0.28, gap + arrow * 0.92]} />
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
