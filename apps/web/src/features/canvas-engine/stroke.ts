import { distanceBetweenPoints } from './geometry'
import type { StrokePoint } from './types'

export type StrokeSimplifyOptions = {
  minDistance?: number
  tolerance?: number
}

export type StrokeSmoothOptions = {
  pressureWeight?: number
  radius?: number
}

export function simplifyStrokePoints(
  points: StrokePoint[],
  options: StrokeSimplifyOptions = {}
): StrokePoint[] {
  if (points.length <= 2) return [...points]

  const minDistance = options.minDistance ?? 0
  const filtered = minDistance > 0 ? removeNearDuplicatePoints(points, minDistance) : [...points]
  const tolerance = options.tolerance ?? 1.5
  if (filtered.length <= 2 || tolerance <= 0) return filtered

  return simplifyDouglasPeucker(filtered, tolerance)
}

export function smoothStrokePoints(
  points: StrokePoint[],
  options: StrokeSmoothOptions = {}
): StrokePoint[] {
  if (points.length <= 2) return [...points]

  const radius = Math.max(1, Math.floor(options.radius ?? 2))
  const pressureWeight = options.pressureWeight ?? 1

  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return { ...point }

    const start = Math.max(0, index - radius)
    const end = Math.min(points.length - 1, index + radius)
    let pressureTotal = 0
    let totalWeight = 0
    let x = 0
    let y = 0

    for (let cursor = start; cursor <= end; cursor += 1) {
      const neighbor = points[cursor]
      const distance = Math.abs(cursor - index)
      const weight = radius + 1 - distance
      x += neighbor.x * weight
      y += neighbor.y * weight
      pressureTotal += (neighbor.pressure ?? point.pressure ?? 0.5) * weight
      totalWeight += weight
    }

    return {
      ...point,
      pressure: blend(point.pressure, pressureTotal / totalWeight, pressureWeight),
      x: x / totalWeight,
      y: y / totalWeight,
    }
  })
}

export function normalizeStrokePoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length === 0) return []
  const origin = points[0]
  return points.map((point) => ({
    ...point,
    x: point.x - origin.x,
    y: point.y - origin.y,
  }))
}

export function denormalizeStrokePoints(points: StrokePoint[], origin: StrokePoint): StrokePoint[] {
  return points.map((point) => ({
    ...point,
    x: point.x + origin.x,
    y: point.y + origin.y,
  }))
}

export function getStrokeLength(points: StrokePoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distanceBetweenPoints(points[index - 1], points[index])
  }
  return length
}

function removeNearDuplicatePoints(points: StrokePoint[], minDistance: number): StrokePoint[] {
  const result: StrokePoint[] = [points[0]]

  for (const point of points.slice(1)) {
    const previous = result[result.length - 1]
    if (distanceBetweenPoints(previous, point) >= minDistance) {
      result.push(point)
    }
  }

  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1])
  }

  return result
}

function simplifyDouglasPeucker(points: StrokePoint[], tolerance: number): StrokePoint[] {
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  simplifySegment(points, 0, points.length - 1, tolerance * tolerance, keep)
  return points.filter((_, index) => keep[index])
}

function simplifySegment(
  points: StrokePoint[],
  start: number,
  end: number,
  toleranceSquared: number,
  keep: boolean[]
): void {
  if (end <= start + 1) return

  let maxDistance = 0
  let maxIndex = start

  for (let index = start + 1; index < end; index += 1) {
    const distance = getPointToSegmentDistanceSquared(points[index], points[start], points[end])
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = index
    }
  }

  if (maxDistance <= toleranceSquared) return

  keep[maxIndex] = true
  simplifySegment(points, start, maxIndex, toleranceSquared, keep)
  simplifySegment(points, maxIndex, end, toleranceSquared, keep)
}

function getPointToSegmentDistanceSquared(point: StrokePoint, start: StrokePoint, end: StrokePoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return squaredDistance(point, start)

  const progress = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  const clampedProgress = Math.min(1, Math.max(0, progress))
  return squaredDistance(point, {
    x: start.x + dx * clampedProgress,
    y: start.y + dy * clampedProgress,
  })
}

function squaredDistance(a: StrokePoint, b: StrokePoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

function blend(original: number | undefined, smoothed: number, weight: number): number | undefined {
  if (original === undefined) return smoothed
  const cleanWeight = Math.min(1, Math.max(0, weight))
  return original * (1 - cleanWeight) + smoothed * cleanWeight
}
