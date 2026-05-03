import { getShapeBounds, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'

export type KonvaSnapGuide = {
  max: number
  min: number
  orientation: 'horizontal' | 'vertical'
  position: number
}

type SnapBoundsResult = {
  bounds: CanvasBounds
  guides: KonvaSnapGuide[]
}

export function snapBoundsToShapes(
  shapes: CanvasShape[],
  movingShapeIds: string[],
  bounds: CanvasBounds,
  threshold: number
): SnapBoundsResult {
  if (threshold <= 0) return { bounds, guides: [] }
  const ignored = new Set(movingShapeIds)
  const targets = shapes.filter((shape) => !ignored.has(shape.id)).map(getShapeBounds)
  const xSnap = findAxisSnap(getAxisPoints(bounds, 'x'), targets, 'x', threshold)
  const ySnap = findAxisSnap(getAxisPoints(bounds, 'y'), targets, 'y', threshold)
  const snapped = moveBounds(bounds, { x: xSnap?.delta ?? 0, y: ySnap?.delta ?? 0 })
  const guides = [
    ...(xSnap ? [createGuide('vertical', xSnap.targetValue, xSnap.targetBounds, snapped)] : []),
    ...(ySnap ? [createGuide('horizontal', ySnap.targetValue, ySnap.targetBounds, snapped)] : []),
  ]
  return { bounds: snapped, guides }
}

function findAxisSnap(
  sourcePoints: Array<{ value: number }>,
  targets: CanvasBounds[],
  axis: 'x' | 'y',
  threshold: number
) {
  let best: { delta: number; distance: number; targetBounds: CanvasBounds; targetValue: number } | null = null
  for (const targetBounds of targets) {
    for (const target of getAxisPoints(targetBounds, axis)) {
      for (const source of sourcePoints) {
        const delta = target.value - source.value
        const distance = Math.abs(delta)
        if (distance <= threshold && (!best || distance < best.distance)) {
          best = { delta, distance, targetBounds, targetValue: target.value }
        }
      }
    }
  }
  return best
}

function getAxisPoints(bounds: CanvasBounds, axis: 'x' | 'y') {
  return axis === 'x'
    ? [
        { value: bounds.minX },
        { value: (bounds.minX + bounds.maxX) / 2 },
        { value: bounds.maxX },
      ]
    : [
        { value: bounds.minY },
        { value: (bounds.minY + bounds.maxY) / 2 },
        { value: bounds.maxY },
      ]
}

function createGuide(orientation: KonvaSnapGuide['orientation'], position: number, target: CanvasBounds, moving: CanvasBounds): KonvaSnapGuide {
  return orientation === 'vertical'
    ? { max: Math.max(target.maxY, moving.maxY), min: Math.min(target.minY, moving.minY), orientation, position }
    : { max: Math.max(target.maxX, moving.maxX), min: Math.min(target.minX, moving.minX), orientation, position }
}

function moveBounds(bounds: CanvasBounds, delta: { x: number; y: number }): CanvasBounds {
  return {
    maxX: bounds.maxX + delta.x,
    maxY: bounds.maxY + delta.y,
    minX: bounds.minX + delta.x,
    minY: bounds.minY + delta.y,
  }
}
