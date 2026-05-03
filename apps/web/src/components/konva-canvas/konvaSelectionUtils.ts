import {
  boundsToRect,
  getShapeBounds,
  type CanvasBounds,
  type CanvasPoint,
  type CanvasShape,
} from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'

const minResizeSize = 12

export function getSelectedShapeBounds(shapes: CanvasShape[], selectedIds: string[]): CanvasBounds | null {
  const selected = new Set(selectedIds)
  const bounds = shapes.filter((shape) => selected.has(shape.id)).map(getShapeBounds)
  if (bounds.length === 0) return null
  return bounds.reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
}

export function getBoxSelectedIds(shapes: CanvasShape[], bounds: CanvasBounds) {
  return shapes
    .filter((shape) => boundsIntersect(getShapeBounds(shape), bounds))
    .map((shape) => shape.id)
}

export function boundsFromPoints(a: CanvasPoint, b: CanvasPoint): CanvasBounds {
  return {
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
  }
}

export function isTinyBounds(bounds: CanvasBounds) {
  const rect = boundsToRect(bounds)
  return rect.width < 4 && rect.height < 4
}

export function isResizableShape(shape: CanvasShape) {
  return 'width' in shape.props && 'height' in shape.props
}

export function resizeShapeToBounds(shape: CanvasShape, bounds: CanvasBounds): CanvasShape {
  if (!isResizableShape(shape)) return shape
  const rect = boundsToRect(bounds)
  return {
    ...shape,
    props: {
      ...shape.props,
      height: Math.max(minResizeSize, rect.height),
      width: Math.max(minResizeSize, rect.width),
    },
    x: rect.x,
    y: rect.y,
  } as CanvasShape
}

export function resizeBoundsFromHandle(
  originBounds: CanvasBounds,
  handle: KonvaResizeHandle,
  point: CanvasPoint,
  options: { preserveAspect?: boolean } = {}
): CanvasBounds {
  const anchor = getOppositeCorner(originBounds, handle)
  const nextPoint = options.preserveAspect ? preserveAspectPoint(anchor, point, originBounds) : point
  return normalizeResizeBounds(boundsFromPoints(anchor, nextPoint))
}

function boundsIntersect(a: CanvasBounds, b: CanvasBounds) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function getOppositeCorner(bounds: CanvasBounds, handle: KonvaResizeHandle): CanvasPoint {
  if (handle === 'nw') return { x: bounds.maxX, y: bounds.maxY }
  if (handle === 'ne') return { x: bounds.minX, y: bounds.maxY }
  if (handle === 'sw') return { x: bounds.maxX, y: bounds.minY }
  return { x: bounds.minX, y: bounds.minY }
}

function normalizeResizeBounds(bounds: CanvasBounds): CanvasBounds {
  const rect = boundsToRect(bounds)
  if (rect.width >= minResizeSize && rect.height >= minResizeSize) return bounds
  return {
    maxX: rect.x + Math.max(minResizeSize, rect.width),
    maxY: rect.y + Math.max(minResizeSize, rect.height),
    minX: rect.x,
    minY: rect.y,
  }
}

function preserveAspectPoint(anchor: CanvasPoint, point: CanvasPoint, bounds: CanvasBounds): CanvasPoint {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const aspect = width / height
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  if (Math.abs(dx) / aspect > Math.abs(dy)) {
    return { x: point.x, y: anchor.y + Math.sign(dy || 1) * Math.abs(dx) / aspect }
  }
  return { x: anchor.x + Math.sign(dx || 1) * Math.abs(dy) * aspect, y: point.y }
}
