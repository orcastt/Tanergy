import { getShapeBounds, type CanvasBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'

export type KonvaSnapGuide = {
  max: number
  min: number
  orientation: 'horizontal' | 'vertical'
  position: number
} | {
  angle: number
  center: { x: number; y: number }
  orientation: 'rotation'
  radius: number
}

type AxisKey = 'center' | 'max' | 'min'

type SnapBoundsResult = {
  bounds: CanvasBounds
  guides: KonvaSnapGuide[]
}

export function snapBoundsToShapes(
  shapes: CanvasShape[],
  movingShapeIds: string[],
  bounds: CanvasBounds,
  threshold: number,
  options: { ignoredTargetBounds?: CanvasBounds[]; sourceKeys?: { x?: AxisKey[]; y?: AxisKey[] } } = {}
): SnapBoundsResult {
  if (threshold <= 0) return { bounds, guides: [] }
  const ignored = new Set(movingShapeIds)
  const targets = shapes
    .filter((shape) => !ignored.has(shape.id))
    .map(getShapeBounds)
    .filter((target) => !options.ignoredTargetBounds?.some((ignoredBounds) => boundsNearlyEqual(target, ignoredBounds)))
  const xSnap = findAxisSnap(getAxisPoints(bounds, 'x', options.sourceKeys?.x), targets, 'x', threshold)
  const ySnap = findAxisSnap(getAxisPoints(bounds, 'y', options.sourceKeys?.y), targets, 'y', threshold)
  const snapped = moveBounds(bounds, { x: xSnap?.delta ?? 0, y: ySnap?.delta ?? 0 })
  const guides = [
    ...(xSnap ? [createGuide('vertical', xSnap.targetValue, xSnap.targetBounds, snapped)] : []),
    ...(ySnap ? [createGuide('horizontal', ySnap.targetValue, ySnap.targetBounds, snapped)] : []),
  ]
  return { bounds: snapped, guides }
}

export function snapResizeBoundsToShapes(
  shapes: CanvasShape[],
  movingShapeIds: string[],
  bounds: CanvasBounds,
  threshold: number,
  sourceKeys: { x?: AxisKey[]; y?: AxisKey[] }
): SnapBoundsResult {
  if (threshold <= 0) return { bounds, guides: [] }
  const ignored = new Set(movingShapeIds)
  const targets = shapes.filter((shape) => !ignored.has(shape.id)).map(getShapeBounds)
  const xSnap = findAxisSnap(getAxisPoints(bounds, 'x', sourceKeys.x), targets, 'x', threshold)
  const ySnap = findAxisSnap(getAxisPoints(bounds, 'y', sourceKeys.y), targets, 'y', threshold)
  const snapped = { ...bounds }
  if (xSnap?.sourceKey === 'min') snapped.minX += xSnap.delta
  if (xSnap?.sourceKey === 'max') snapped.maxX += xSnap.delta
  if (ySnap?.sourceKey === 'min') snapped.minY += ySnap.delta
  if (ySnap?.sourceKey === 'max') snapped.maxY += ySnap.delta
  const guides = [
    ...(xSnap ? [createGuide('vertical', xSnap.targetValue, xSnap.targetBounds, snapped)] : []),
    ...(ySnap ? [createGuide('horizontal', ySnap.targetValue, ySnap.targetBounds, snapped)] : []),
  ]
  return { bounds: snapped, guides }
}

export function snapRotationAngle(rotation: number, thresholdDegrees: number, stepDegrees = 15) {
  const snapped = Math.round(rotation / stepDegrees) * stepDegrees
  return Math.abs(snapped - rotation) <= thresholdDegrees ? snapped : rotation
}

export function getRotationSnapGuides(rawRotation: number, rotation: number, center: CanvasPoint, radius: number): KonvaSnapGuide[] {
  return rotation === rawRotation ? [] : [{ angle: rotation, center, orientation: 'rotation', radius }]
}

export function getResizeSnapSourceKeys(handle: KonvaResizeHandle) {
  return {
    x: handle === 'nw' || handle === 'sw' ? ['min' as const] : ['max' as const],
    y: handle === 'nw' || handle === 'ne' ? ['min' as const] : ['max' as const],
  }
}

function findAxisSnap(
  sourcePoints: Array<{ key: AxisKey; value: number }>,
  targets: CanvasBounds[],
  axis: 'x' | 'y',
  threshold: number
) {
  let best: { delta: number; distance: number; sourceKey: AxisKey; targetBounds: CanvasBounds; targetValue: number } | null = null
  for (const targetBounds of targets) {
    for (const target of getAxisPoints(targetBounds, axis)) {
      for (const source of sourcePoints) {
        const delta = target.value - source.value
        const distance = Math.abs(delta)
        if (distance <= threshold && (!best || distance < best.distance)) {
          best = { delta, distance, sourceKey: source.key, targetBounds, targetValue: target.value }
        }
      }
    }
  }
  return best
}

function getAxisPoints(bounds: CanvasBounds, axis: 'x' | 'y', keys?: AxisKey[]) {
  const points = axis === 'x'
    ? [
        { key: 'min' as const, value: bounds.minX },
        { key: 'center' as const, value: (bounds.minX + bounds.maxX) / 2 },
        { key: 'max' as const, value: bounds.maxX },
      ]
    : [
        { key: 'min' as const, value: bounds.minY },
        { key: 'center' as const, value: (bounds.minY + bounds.maxY) / 2 },
        { key: 'max' as const, value: bounds.maxY },
      ]
  return keys ? points.filter((point) => keys.includes(point.key)) : points
}

function createGuide(orientation: 'horizontal' | 'vertical', position: number, target: CanvasBounds, moving: CanvasBounds): KonvaSnapGuide {
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

function boundsNearlyEqual(a: CanvasBounds, b: CanvasBounds, epsilon = 0.5) {
  return Math.abs(a.minX - b.minX) <= epsilon
    && Math.abs(a.minY - b.minY) <= epsilon
    && Math.abs(a.maxX - b.maxX) <= epsilon
    && Math.abs(a.maxY - b.maxY) <= epsilon
}
