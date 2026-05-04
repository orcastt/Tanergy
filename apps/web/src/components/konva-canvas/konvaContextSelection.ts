import { getShapeBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { expandKonvaGroupedShapeIds } from './konvaGroupCommands'

export function getKonvaContextTargetSelection(shapes: CanvasShape[], point: CanvasPoint, selectedIds: string[]) {
  if (selectedIds.length > 1) return selectedIds
  const hitShape = [...shapes].reverse().find((shape) => boundsContainPoint(getShapeBounds(shape), point))
  return hitShape ? expandKonvaGroupedShapeIds(shapes, [hitShape.id]) : []
}

function boundsContainPoint(bounds: ReturnType<typeof getShapeBounds>, point: CanvasPoint) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
}
