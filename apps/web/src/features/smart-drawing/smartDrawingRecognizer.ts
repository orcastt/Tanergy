import { b64Vecs } from 'tldraw'

export type SmartDrawingPoint = {
  x: number
  y: number
}

export type SmartDrawingStyle = {
  color?: string
  dash?: string
  fill?: string
  opacity?: number
  size?: string
}

export type SmartDrawingInput = {
  id: string
  opacity?: number
  props: {
    color?: string
    dash?: string
    fill?: string
    isClosed?: boolean
    scale?: number
    scaleX?: number
    scaleY?: number
    segments?: Array<{ path?: string; points?: Array<{ x: number; y: number }> }>
    size?: string
  }
  x: number
  y: number
}

export type SmartDrawingResult =
  | {
    kind: 'geo'
    geo: 'ellipse' | 'rectangle' | 'triangle'
    h: number
    style: SmartDrawingStyle
    w: number
    x: number
    y: number
  }
  | {
    kind: 'line'
    points: SmartDrawingPoint[]
    spline: 'cubic' | 'line'
    style: SmartDrawingStyle
    x: number
    y: number
  }

const minStrokeLength = 28
const minShapeSize = 18

export function recognizeSmartDrawing(shape: SmartDrawingInput): SmartDrawingResult | null {
  const points = getDrawPoints(shape)
  if (points.length < 3) return null

  const bounds = getBounds(points)
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const length = getPathLength(points)
  if (length < minStrokeLength || Math.max(width, height) < minShapeSize) return null

  const style = getStyle(shape)
  const lineConfidence = getLineConfidence(points, length)
  if (lineConfidence > 0.92) {
    return createLineResult([points[0], points[points.length - 1]], 'line', style)
  }

  const closed = shape.props.isClosed || getDistance(points[0], points[points.length - 1]) < Math.max(18, Math.min(width, height) * 0.26)
  if (closed && width >= minShapeSize && height >= minShapeSize) {
    const corners = simplifyClosedCorners(points, Math.max(8, Math.min(width, height) * 0.12))
    const ellipseError = getEllipseError(points, bounds)
    if (corners.length === 3) return createGeoResult(bounds, 'triangle', style)
    if (corners.length === 4 && getRectangleConfidence(corners, bounds) > 0.58) {
      return createGeoResult(bounds, 'rectangle', style)
    }
    if (ellipseError < 0.28 && corners.length > 4) return createGeoResult(bounds, 'ellipse', style)
  }

  const curve = simplifyOpenCurve(points, Math.max(10, length * 0.035))
  if (curve.length >= 3 && curve.length <= 4 && getTotalTurn(points) < Math.PI * 1.2) {
    return createLineResult(curve, 'cubic', style)
  }

  return null
}

function getDrawPoints(shape: SmartDrawingInput) {
  const scale = shape.props.scale ?? 1
  const scaleX = shape.props.scaleX ?? scale
  const scaleY = shape.props.scaleY ?? scale
  return (shape.props.segments ?? []).flatMap((segment) => {
    const points = segment.points ?? decodePath(segment.path)
    return points.map((point) => ({
      x: shape.x + point.x * scaleX,
      y: shape.y + point.y * scaleY,
    }))
  }).filter(isFinitePoint)
}

function decodePath(path: string | undefined): SmartDrawingPoint[] {
  if (!path) return []
  try {
    return b64Vecs.decodePoints(path)
  } catch {
    try {
      return (b64Vecs as typeof b64Vecs & {
        _legacyDecodePoints: (value: string) => SmartDrawingPoint[]
      })._legacyDecodePoints(path)
    } catch {
      return []
    }
  }
}

function createGeoResult(
  bounds: ReturnType<typeof getBounds>,
  geo: Extract<SmartDrawingResult, { kind: 'geo' }>['geo'],
  style: SmartDrawingStyle
): SmartDrawingResult {
  return {
    geo,
    h: Math.max(minShapeSize, bounds.maxY - bounds.minY),
    kind: 'geo',
    style,
    w: Math.max(minShapeSize, bounds.maxX - bounds.minX),
    x: bounds.minX,
    y: bounds.minY,
  }
}

function createLineResult(points: SmartDrawingPoint[], spline: 'cubic' | 'line', style: SmartDrawingStyle): SmartDrawingResult {
  const bounds = getBounds(points)
  return {
    kind: 'line',
    points: points.map((point) => ({ x: point.x - bounds.minX, y: point.y - bounds.minY })),
    spline,
    style,
    x: bounds.minX,
    y: bounds.minY,
  }
}

function getStyle(shape: SmartDrawingInput): SmartDrawingStyle {
  return {
    color: shape.props.color,
    dash: shape.props.dash,
    fill: shape.props.fill,
    opacity: shape.opacity,
    size: shape.props.size,
  }
}

function getLineConfidence(points: SmartDrawingPoint[], length: number) {
  const start = points[0]
  const end = points[points.length - 1]
  const direct = getDistance(start, end)
  if (direct < minStrokeLength) return 0
  const maxDeviation = Math.max(...points.map((point) => getDistanceToSegment(point, start, end)))
  return (direct / Math.max(length, 1)) * (1 - Math.min(0.5, maxDeviation / Math.max(direct, 1)))
}

function simplifyClosedCorners(points: SmartDrawingPoint[], epsilon: number) {
  const simplified = simplifyPoints(points, epsilon)
  const withoutDuplicate = [...simplified]
  if (withoutDuplicate.length > 2 && getDistance(withoutDuplicate[0], withoutDuplicate[withoutDuplicate.length - 1]) < epsilon * 1.25) {
    withoutDuplicate.pop()
  }
  return withoutDuplicate
}

function simplifyOpenCurve(points: SmartDrawingPoint[], epsilon: number) {
  return simplifyPoints(points, epsilon)
}

function simplifyPoints(points: SmartDrawingPoint[], epsilon: number): SmartDrawingPoint[] {
  if (points.length <= 2) return points
  let maxDistance = 0
  let maxIndex = 0
  const start = points[0]
  const end = points[points.length - 1]
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getDistanceToSegment(points[index], start, end)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = index
    }
  }
  if (maxDistance <= epsilon) return [start, end]
  return [
    ...simplifyPoints(points.slice(0, maxIndex + 1), epsilon).slice(0, -1),
    ...simplifyPoints(points.slice(maxIndex), epsilon),
  ]
}

function getRectangleConfidence(points: SmartDrawingPoint[], bounds: ReturnType<typeof getBounds>) {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width < minShapeSize || height < minShapeSize) return 0
  const edgeDistance = points.reduce((total, point) => {
    const distance = Math.min(
      Math.abs(point.x - bounds.minX),
      Math.abs(point.x - bounds.maxX),
      Math.abs(point.y - bounds.minY),
      Math.abs(point.y - bounds.maxY)
    )
    return total + distance
  }, 0) / points.length
  return 1 - Math.min(1, edgeDistance / Math.max(8, Math.min(width, height) * 0.18))
}

function getEllipseError(points: SmartDrawingPoint[], bounds: ReturnType<typeof getBounds>) {
  const rx = Math.max((bounds.maxX - bounds.minX) / 2, 1)
  const ry = Math.max((bounds.maxY - bounds.minY) / 2, 1)
  const cx = bounds.minX + rx
  const cy = bounds.minY + ry
  return points.reduce((total, point) => {
    const value = ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2
    return total + Math.abs(1 - value)
  }, 0) / points.length
}

function getTotalTurn(points: SmartDrawingPoint[]) {
  let total = 0
  for (let index = 2; index < points.length; index += 1) {
    const a = getAngle(points[index - 2], points[index - 1])
    const b = getAngle(points[index - 1], points[index])
    total += Math.abs(normalizeAngle(b - a))
  }
  return total
}

function getBounds(points: SmartDrawingPoint[]) {
  return points.reduce((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
  }), {
    maxX: points[0].x,
    maxY: points[0].y,
    minX: points[0].x,
    minY: points[0].y,
  })
}

function getPathLength(points: SmartDrawingPoint[]) {
  return points.slice(1).reduce((total, point, index) => total + getDistance(points[index], point), 0)
}

function getDistance(a: SmartDrawingPoint, b: SmartDrawingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getDistanceToSegment(point: SmartDrawingPoint, start: SmartDrawingPoint, end: SmartDrawingPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return getDistance(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return getDistance(point, { x: start.x + t * dx, y: start.y + t * dy })
}

function getAngle(a: SmartDrawingPoint, b: SmartDrawingPoint) {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function normalizeAngle(value: number) {
  let angle = value
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function isFinitePoint(point: SmartDrawingPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
