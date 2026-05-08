import type { CanvasBounds, CanvasPoint } from '@/features/canvas-engine'

export type KonvaRuntimeEdgeControls = [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint]

export function getKonvaRuntimeEdgeBounds(start: CanvasPoint, target: CanvasPoint): CanvasBounds {
  const controls = getKonvaRuntimeEdgeControls(start, target)
  return controls.reduce<CanvasBounds>((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
  }), {
    maxX: controls[0].x,
    maxY: controls[0].y,
    minX: controls[0].x,
    minY: controls[0].y,
  })
}

export function getKonvaRuntimeEdgePath(start: CanvasPoint, target: CanvasPoint) {
  return getBezierPath(getKonvaRuntimeEdgeControls(start, target))
}

function getKonvaRuntimeEdgeControls(start: CanvasPoint, target: CanvasPoint): KonvaRuntimeEdgeControls {
  const distanceX = Math.abs(target.x - start.x)
  const distanceY = Math.abs(target.y - start.y)
  const offset = Math.max(56, Math.min(180, distanceX * 0.5 + distanceY * 0.12))
  return [
    start,
    { x: start.x + offset, y: start.y },
    { x: target.x - offset, y: target.y },
    target,
  ]
}

function getBezierPath([start, first, second, target]: KonvaRuntimeEdgeControls) {
  return [
    `M ${format(start.x)} ${format(start.y)}`,
    `C ${format(first.x)} ${format(first.y)}`,
    `${format(second.x)} ${format(second.y)}`,
    `${format(target.x)} ${format(target.y)}`,
  ].join(' ')
}

function format(value: number) {
  return Number(value.toFixed(1))
}
