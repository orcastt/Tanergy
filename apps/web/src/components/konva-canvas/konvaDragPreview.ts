import type { CanvasBounds, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import { getSelectedShapeBounds, getShapesByIds, moveBounds, moveShapesFromOrigins } from './konvaSelectionUtils'

export type KonvaShapeDragPreview = {
  baseShapes: CanvasShape[]
  ignoredSnapIds: string[]
  lastPoint?: CanvasPoint
  originBounds: CanvasBounds
  originShape: CanvasShape
  originShapes: CanvasShape[]
  selectOnEndIds?: string[]
  shapeId: string
}

export function createShapeDragPreview(shapes: CanvasShape[], selectedIds: string[], shapeId: string): KonvaShapeDragPreview | null {
  const shapeIds = selectedIds.includes(shapeId) ? selectedIds : [shapeId]
  const originShape = shapes.find((shape) => shape.id === shapeId)
  const originShapes = getShapesByIds(shapes, shapeIds)
  return originShape ? createShapeDragPreviewFromOrigins(originShape, originShapes, shapeId, { baseShapes: shapes, ignoredSnapIds: shapeIds }) : null
}

export function createShapeDragPreviewFromOrigins(
  originShape: CanvasShape,
  originShapes: CanvasShape[],
  shapeId: string,
  options: { baseShapes: CanvasShape[]; ignoredSnapIds: string[]; selectOnEndIds?: string[] }
): KonvaShapeDragPreview | null {
  const shapeIds = originShapes.map((shape) => shape.id)
  const originBounds = getSelectedShapeBounds(originShapes, shapeIds)
  return originShape && originBounds && originShapes.length > 0
    ? { baseShapes: options.baseShapes, ignoredSnapIds: options.ignoredSnapIds, originBounds, originShape, originShapes, selectOnEndIds: options.selectOnEndIds, shapeId }
    : null
}

export function getShapeDragDelta(preview: KonvaShapeDragPreview, x: number, y: number): CanvasPoint {
  return {
    x: x - preview.originShape.x,
    y: y - preview.originShape.y,
  }
}

export function getShapeDragPreviewBounds(preview: KonvaShapeDragPreview, x: number, y: number): CanvasBounds {
  return moveBounds(preview.originBounds, getShapeDragDelta(preview, x, y))
}

export function getShapeDragPreviewShapes(preview: KonvaShapeDragPreview, x: number, y: number): CanvasShape[] {
  return moveShapesFromOrigins(preview.baseShapes, preview.originShapes, getShapeDragDelta(preview, x, y))
}
