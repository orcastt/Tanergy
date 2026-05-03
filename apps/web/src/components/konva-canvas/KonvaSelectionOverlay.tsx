import type { KonvaEventObject } from 'konva/lib/Node'
import { Fragment } from 'react'
import { Circle, Rect } from 'react-konva'
import { boundsToRect, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { getSelectedShapeBounds } from './konvaSelectionUtils'

type KonvaSelectionOverlayProps = {
  selectedBoundsOverride?: CanvasBounds | null
  selectionBox: CanvasBounds | null
  selectedIds: string[]
  shapes: CanvasShape[]
  zoom: number
  onResizeStart: (shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaSelectionOverlay({
  onResizeStart,
  selectedBoundsOverride,
  selectedIds,
  selectionBox,
  shapes,
  zoom,
}: KonvaSelectionOverlayProps) {
  const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id))
  const selectedBounds = selectedBoundsOverride ?? (selectedShapes.length > 0 ? getSelectedShapeBounds(shapes, selectedIds) : null)
  const canResize = selectedShapes.length > 0
  const showUnionBox = Boolean(selectedBoundsOverride) || selectedIds.length > 1

  return (
    <>
      {selectionBox ? <SelectionRect bounds={selectionBox} zoom={zoom} /> : null}
      {selectedBounds && showUnionBox ? (
        <SelectionRect bounds={selectedBounds} isSelection zoom={zoom} />
      ) : null}
      {selectedBounds && canResize ? (
        <ResizeHandles
          bounds={selectedBounds}
          onResizeStart={(handle, event) => onResizeStart(selectedIds, handle, event)}
          zoom={zoom}
        />
      ) : null}
    </>
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
