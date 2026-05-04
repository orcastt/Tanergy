import { getShapeBounds, type CanvasBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { isBoxCanvasShape, rotatePointAroundCenter } from './konvaRotationUtils'
import { getLineRoute, getOrthogonalBends } from './konvaLineRouteUtils'

export type KonvaOrientedBounds = {
  center: CanvasPoint
  localBounds: CanvasBounds
  rotation: number
}

const rotatedBoundsThreshold = 0.1

export function getKonvaOrientedBounds(shapes: CanvasShape[]): KonvaOrientedBounds | null {
  const points = shapes.flatMap(getShapePoints)
  if (points.length < 2) return null
  const candidates = getCandidateAngles(shapes)
  let best: { area: number; bounds: CanvasBounds; rotation: number } | null = null

  for (const rotation of candidates) {
    const bounds = getRotatedPointBounds(points, -rotation)
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    if (!best || area < best.area) best = { area, bounds, rotation }
  }

  if (!best || Math.abs(normalizeRightAngle(best.rotation)) < rotatedBoundsThreshold) return null
  const localCenter = {
    x: (best.bounds.minX + best.bounds.maxX) / 2,
    y: (best.bounds.minY + best.bounds.maxY) / 2,
  }
  const center = rotatePoint(localCenter, best.rotation)
  const width = best.bounds.maxX - best.bounds.minX
  const height = best.bounds.maxY - best.bounds.minY
  return {
    center,
    localBounds: {
      maxX: width / 2,
      maxY: height / 2,
      minX: -width / 2,
      minY: -height / 2,
    },
    rotation: best.rotation,
  }
}

function getCandidateAngles(shapes: CanvasShape[]) {
  const angles = new Set<number>([0])
  for (const shape of shapes) {
    if (isBoxCanvasShape(shape)) {
      addAngle(angles, shape.rotation ?? 0)
      continue
    }
    for (const angle of getLineLikeAngles(shape)) addAngle(angles, angle)
  }
  return [...angles]
}

function addAngle(angles: Set<number>, angle: number) {
  angles.add(normalizeRightAngle(angle))
  angles.add(normalizeRightAngle(angle + 90))
}

function getLineLikeAngles(shape: CanvasShape) {
  const points = getShapePoints(shape)
  return points.flatMap((point, index) => {
    if (index === 0) return []
    const previous = points[index - 1]
    return Math.atan2(point.y - previous.y, point.x - previous.x) * 180 / Math.PI
  })
}

function getShapePoints(shape: CanvasShape): CanvasPoint[] {
  if (shape.type === 'line' || shape.type === 'arrow') {
    const bends = getLineRoute(shape) === 'orthogonal' ? getOrthogonalBends(shape) : shape.props.bends ?? []
    return [
      { x: shape.x, y: shape.y },
      ...bends.map((point) => ({ x: shape.x + point.x, y: shape.y + point.y })),
      shape.props.control ? { x: shape.x + shape.props.control.x, y: shape.y + shape.props.control.y } : null,
      { x: shape.x + shape.props.end.x, y: shape.y + shape.props.end.y },
    ].filter((point): point is CanvasPoint => Boolean(point))
  }
  if (shape.type === 'stroke') return shape.props.points.map((point) => ({ x: shape.x + point.x, y: shape.y + point.y }))
  if (isBoxCanvasShape(shape)) return getBoxPoints(shape)
  const bounds = getShapeBounds(shape)
  return getBoundsPoints(bounds)
}

function getBoxPoints(shape: Extract<CanvasShape, { props: { height: number; width: number } }>) {
  const { height, width } = shape.props
  const center = { x: shape.x + width / 2, y: shape.y + height / 2 }
  return getBoundsPoints({ maxX: shape.x + width, maxY: shape.y + height, minX: shape.x, minY: shape.y })
    .map((point) => rotatePointAroundCenter(point, center, shape.rotation ?? 0))
}

function getBoundsPoints(bounds: CanvasBounds) {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ]
}

function getRotatedPointBounds(points: CanvasPoint[], rotation: number) {
  const [first, ...rest] = points.map((point) => rotatePoint(point, rotation))
  if (!first) return { maxX: 0, maxY: 0, minX: 0, minY: 0 }
  return rest.reduce<CanvasBounds>((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
  }), { maxX: first.x, maxY: first.y, minX: first.x, minY: first.y })
}

function normalizeRightAngle(rotation: number) {
  const normalized = ((rotation % 180) + 180) % 180
  return normalized > 90 ? normalized - 180 : normalized
}

function rotatePoint(point: CanvasPoint, rotation: number): CanvasPoint {
  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}
