import { getShapeBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { expandKonvaGroupedShapeIds } from './konvaGroupCommands'

export function getKonvaContextTargetSelection(shapes: CanvasShape[], point: CanvasPoint, selectedIds: string[]) {
  if (selectedIds.length > 1) return selectedIds
  const hitShape = findKonvaHitShape(shapes, point)
  return hitShape ? expandKonvaGroupedShapeIds(shapes, [hitShape.id]) : []
}

export function getKonvaHoveredShapeId(shapes: CanvasShape[], point: CanvasPoint) {
  return findKonvaHitShape(shapes, point)?.id ?? null
}

function findKonvaHitShape(shapes: CanvasShape[], point: CanvasPoint) {
  return [...shapes].reverse().find((shape) => boundsContainPoint(getShapeBounds(shape), point))
}

function boundsContainPoint(bounds: ReturnType<typeof getShapeBounds>, point: CanvasPoint) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
}
