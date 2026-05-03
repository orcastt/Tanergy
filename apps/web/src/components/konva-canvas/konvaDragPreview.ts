import type { CanvasBounds, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import { getSelectedShapeBounds, getShapesByIds, moveBounds, moveShapesFromOrigins } from './konvaSelectionUtils'

export type KonvaShapeDragPreview = {
  originBounds: CanvasBounds
  originShape: CanvasShape
  originShapes: CanvasShape[]
  shapeId: string
}

export function createShapeDragPreview(shapes: CanvasShape[], selectedIds: string[], shapeId: string): KonvaShapeDragPreview | null {
  const shapeIds = selectedIds.includes(shapeId) ? selectedIds : [shapeId]
  const originShape = shapes.find((shape) => shape.id === shapeId)
  const originShapes = getShapesByIds(shapes, shapeIds)
  const originBounds = getSelectedShapeBounds(shapes, shapeIds)
  return originShape && originBounds && originShapes.length > 0
    ? { originBounds, originShape, originShapes, shapeId }
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

export function getShapeDragPreviewShapes(shapes: CanvasShape[], preview: KonvaShapeDragPreview, x: number, y: number): CanvasShape[] {
  return moveShapesFromOrigins(shapes, preview.originShapes, getShapeDragDelta(preview, x, y))
}
