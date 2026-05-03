import type { CanvasBounds, CanvasShape } from '@/features/canvas-engine'
import { getSelectedShapeBounds, moveBounds } from './konvaSelectionUtils'

export type KonvaShapeDragPreview = {
  originBounds: CanvasBounds
  originShape: CanvasShape
  shapeId: string
}

export function createShapeDragPreview(shapes: CanvasShape[], shapeId: string): KonvaShapeDragPreview | null {
  const originShape = shapes.find((shape) => shape.id === shapeId)
  const originBounds = getSelectedShapeBounds(shapes, [shapeId])
  return originShape && originBounds ? { originBounds, originShape, shapeId } : null
}

export function getShapeDragPreviewBounds(preview: KonvaShapeDragPreview, x: number, y: number): CanvasBounds {
  return moveBounds(preview.originBounds, {
    x: x - preview.originShape.x,
    y: y - preview.originShape.y,
  })
}
