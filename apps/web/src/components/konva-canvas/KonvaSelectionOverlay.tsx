import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Rect } from 'react-konva'
import { boundsToRect, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { getSelectedShapeBounds, isResizableShape } from './konvaSelectionUtils'

type KonvaSelectionOverlayProps = {
  selectionBox: CanvasBounds | null
  selectedIds: string[]
  shapes: CanvasShape[]
  zoom: number
  onResizeStart: (shapeId: string, handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaSelectionOverlay({
  onResizeStart,
  selectedIds,
  selectionBox,
  shapes,
  zoom,
}: KonvaSelectionOverlayProps) {
  const selectedShape = selectedIds.length === 1 ? shapes.find((shape) => shape.id === selectedIds[0]) : null
  const selectedBounds = selectedShape && isResizableShape(selectedShape) ? getSelectedShapeBounds(shapes, selectedIds) : null

  return (
    <>
      {selectionBox ? <SelectionRect bounds={selectionBox} zoom={zoom} /> : null}
      {selectedBounds && selectedShape ? (
        <ResizeHandles
          bounds={selectedBounds}
          onResizeStart={(handle, event) => onResizeStart(selectedShape.id, handle, event)}
          zoom={zoom}
        />
      ) : null}
    </>
  )
}

function SelectionRect({ bounds, zoom }: { bounds: CanvasBounds; zoom: number }) {
  const rect = boundsToRect(bounds)
  return (
    <Rect
      dash={[5 / zoom, 4 / zoom]}
      fill="rgba(107, 92, 255, 0.08)"
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
  const size = Math.max(5, 8 / zoom)
  return (
    <>
      {[
        ['nw', bounds.minX, bounds.minY],
        ['ne', bounds.maxX, bounds.minY],
        ['se', bounds.maxX, bounds.maxY],
        ['sw', bounds.minX, bounds.maxY],
      ].map(([handle, x, y]) => (
        <Circle
          fill="#ffffff"
          key={handle}
          onPointerDown={(event) => onResizeStart(handle as KonvaResizeHandle, event)}
          radius={size / 2}
          stroke="#6b5cff"
          strokeWidth={1 / zoom}
          x={x as number}
          y={y as number}
        />
      ))}
    </>
  )
}
