import type { KonvaEventObject } from 'konva/lib/Node'
import { Fragment } from 'react'
import { Circle, Group, Line, Path, Rect } from 'react-konva'
import { boundsToRect, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle, KonvaLineRouteHandle, KonvaResizeHandle } from './konvaCanvasTypes'
import type { KonvaImageCropHandle } from './konvaImageCropCommands'
import { KonvaLockIndicators } from './KonvaLockIndicators'
import { KonvaLineControls } from './KonvaLineControls'
import { getKonvaOrientedBounds } from './konvaOrientedBounds'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { getSelectedShapeBounds } from './konvaSelectionUtils'
import { canKonvaSelectionRotate, canKonvaShapeRotate } from './konvaShapeCapabilities'
import type { KonvaSnapGuide } from './konvaSnapping'

type KonvaSelectionOverlayProps = {
  selectedBoundsOverride?: CanvasBounds | null
  cropEditingImageId?: string | null
  selectionBox: CanvasBounds | null
  selectedIds: string[]
  shapes: CanvasShape[]
  snapGuides: KonvaSnapGuide[]
  zoom: number
  onImageCropStart: (shapeId: string, handle: KonvaImageCropHandle, event: KonvaEventObject<PointerEvent>) => void
  onLineEndpointStart: (shapeId: string, endpoint: KonvaLineEndpointHandle, event: KonvaEventObject<PointerEvent>) => void
  onLineRouteHandleStart: (shapeId: string, handle: KonvaLineRouteHandle, event: KonvaEventObject<PointerEvent>) => void
  onResizeStart: (shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  onRotateStart: (shapeIds: string[], event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaSelectionOverlay({
  cropEditingImageId,
  onImageCropStart,
  onLineEndpointStart,
  onLineRouteHandleStart,
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
  const selectionCanRotate = canKonvaSelectionRotate(selectedShapes)
  const canResize = selectedShapes.length > 0
  const onlySelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null
  const singleLineShape = onlySelectedShape && (onlySelectedShape.type === 'line' || onlySelectedShape.type === 'arrow') ? onlySelectedShape : null
  const cropEditingShape = onlySelectedShape?.type === 'image' && onlySelectedShape.id === cropEditingImageId ? onlySelectedShape : null
  const singleBoxShape = onlySelectedShape && canKonvaShapeRotate(onlySelectedShape) && isBoxCanvasShape(onlySelectedShape) && !selectedBoundsOverride ? onlySelectedShape : null
  const orientedSelectionBounds = selectedShapes.length > 1 && selectionCanRotate ? getKonvaOrientedBounds(selectedShapes) : null
  const showUnionBox = Boolean(selectedBoundsOverride) || selectedIds.length > 1

  return (
    <>
      {snapGuides.map((guide, index) => <SnapGuide guide={guide} key={getSnapGuideKey(guide, index)} zoom={zoom} />)}
      <KonvaLockIndicators shapes={shapes} zoom={zoom} />
      {selectionBox ? <SelectionRect bounds={selectionBox} zoom={zoom} /> : null}
      {orientedSelectionBounds ? (
        <OrientedSelectionControls
          box={orientedSelectionBounds}
          onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
          onRotateStart={(event) => onRotateStart(selectedIds, event)}
          zoom={zoom}
        />
      ) : selectedBounds && showUnionBox ? (
        <SelectionRect bounds={selectedBounds} isSelection zoom={zoom} />
      ) : null}
      {cropEditingShape ? (
        <ImageCropControls
          onCropStart={(handle, event) => onImageCropStart(cropEditingShape.id, handle, event)}
          shape={cropEditingShape}
          zoom={zoom}
        />
      ) : singleLineShape && !selectedBoundsOverride ? (
        <KonvaLineControls
          onEndpointStart={(endpoint, event) => onLineEndpointStart(singleLineShape.id, endpoint, event)}
          onRouteHandleStart={(handle, event) => onLineRouteHandleStart(singleLineShape.id, handle, event)}
          shape={singleLineShape}
          zoom={zoom}
        />
      ) : singleBoxShape ? (
        <SingleShapeControls
          onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
          onRotateStart={(event) => onRotateStart([singleBoxShape.id], event)}
          shape={singleBoxShape}
          zoom={zoom}
        />
      ) : !orientedSelectionBounds && selectedBounds && canResize ? (
        <>
          <ResizeHandles
            bounds={selectedBounds}
            onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
            zoom={zoom}
          />
          {selectedIds.length > 1 && selectionCanRotate ? (
            <RotateHandle
              onRotateStart={(event) => onRotateStart(selectedIds, event)}
              x={selectedBounds.maxX + 24 / zoom}
              y={selectedBounds.minY - 24 / zoom}
              zoom={zoom}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

function OrientedSelectionControls({
  box,
  onResizeStart,
  onRotateStart,
  zoom,
}: {
  box: NonNullable<ReturnType<typeof getKonvaOrientedBounds>>
  onResizeStart: (handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
  onRotateStart: (event: KonvaEventObject<PointerEvent>) => void
  zoom: number
}) {
  return (
    <Group rotation={box.rotation} x={box.center.x} y={box.center.y}>
      <SelectionRect bounds={box.localBounds} isSelection zoom={zoom} />
      <ResizeHandles bounds={box.localBounds} onResizeStart={onResizeStart} zoom={zoom} />
      <RotateHandle onRotateStart={onRotateStart} x={box.localBounds.maxX + 24 / zoom} y={box.localBounds.minY - 24 / zoom} zoom={zoom} />
    </Group>
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

function ImageCropControls({
  onCropStart,
  shape,
  zoom,
}: {
  onCropStart: (handle: KonvaImageCropHandle, event: KonvaEventObject<PointerEvent>) => void
  shape: Extract<CanvasShape, { type: 'image' }>
  zoom: number
}) {
  const width = shape.props.width
  const height = shape.props.height
  const bounds = { maxX: width / 2, maxY: height / 2, minX: -width / 2, minY: -height / 2 }
  const hitWidth = Math.max(12, 16 / zoom)
  const visibleRadius = Math.max(4.5, 5.5 / zoom)
  const visibleWidth = Math.max(2, 2.4 / zoom)
  return (
    <Group rotation={shape.rotation ?? 0} x={shape.x + width / 2} y={shape.y + height / 2}>
      <SelectionRect bounds={bounds} isSelection zoom={zoom} />
      <CropEdge handle="top" hitWidth={hitWidth} onCropStart={onCropStart} points={[bounds.minX, bounds.minY, bounds.maxX, bounds.minY]} visibleWidth={visibleWidth} />
      <CropEdge handle="right" hitWidth={hitWidth} onCropStart={onCropStart} points={[bounds.maxX, bounds.minY, bounds.maxX, bounds.maxY]} visibleWidth={visibleWidth} />
      <CropEdge handle="bottom" hitWidth={hitWidth} onCropStart={onCropStart} points={[bounds.minX, bounds.maxY, bounds.maxX, bounds.maxY]} visibleWidth={visibleWidth} />
      <CropEdge handle="left" hitWidth={hitWidth} onCropStart={onCropStart} points={[bounds.minX, bounds.minY, bounds.minX, bounds.maxY]} visibleWidth={visibleWidth} />
      <CropCornerDots bounds={bounds} radius={visibleRadius} zoom={zoom} />
    </Group>
  )
}

function CropEdge({
  handle,
  hitWidth,
  onCropStart,
  points,
  visibleWidth,
}: {
  handle: KonvaImageCropHandle
  hitWidth: number
  onCropStart: (handle: KonvaImageCropHandle, event: KonvaEventObject<PointerEvent>) => void
  points: number[]
  visibleWidth: number
}) {
  return (
    <>
      <Line hitStrokeWidth={hitWidth} onPointerDown={(event) => onCropStart(handle, event)} points={points} stroke="rgba(17, 24, 39, 0.001)" strokeWidth={hitWidth} />
      <Line listening={false} points={points} stroke="#6b5cff" strokeLinecap="round" strokeWidth={visibleWidth} />
    </>
  )
}

function CropCornerDots({ bounds, radius, zoom }: { bounds: CanvasBounds; radius: number; zoom: number }) {
  return (
    <>
      {[
        [bounds.minX, bounds.minY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
        [bounds.minX, bounds.maxY],
      ].map(([x, y], index) => (
        <Circle
          fill="#ffffff"
          key={index}
          listening={false}
          radius={radius}
          stroke="#6b5cff"
          strokeWidth={1.2 / zoom}
          x={x}
          y={y}
        />
      ))}
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
