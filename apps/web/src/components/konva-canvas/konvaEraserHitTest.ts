import { getShapeBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'

export function getShapesAfterPreciseErase(shapes: CanvasShape[], point: CanvasPoint, radius: number) {
  return shapes.filter((shape) => !shapeContainsErasePoint(shape, point, radius))
}

function shapeContainsErasePoint(shape: CanvasShape, point: CanvasPoint, radius: number) {
  const strokePadding = (shape.style?.strokeWidth ?? 2) / 2 + radius + 2
  if (shape.type === 'line' || shape.type === 'arrow') {
    const start = { x: shape.x, y: shape.y }
    const end = { x: shape.x + shape.props.end.x, y: shape.y + shape.props.end.y }
    if (!shape.props.control) return distanceToSegment(point, start, end) <= strokePadding
    return sampledQuadraticHit(point, start, { x: shape.x + shape.props.control.x, y: shape.y + shape.props.control.y }, end, strokePadding)
  }

  if (shape.type === 'stroke') {
    const points = shape.props.points.map((item) => ({ x: shape.x + item.x, y: shape.y + item.y }))
    if (points.length === 1) return distance(point, points[0]) <= strokePadding
    return points.some((current, index) => index > 0 && distanceToSegment(point, points[index - 1], current) <= strokePadding)
  }

  return boundsContainPoint(getShapeBounds(shape), point, radius)
}

function sampledQuadraticHit(point: CanvasPoint, start: CanvasPoint, control: CanvasPoint, end: CanvasPoint, padding: number) {
  let previous = start
  for (let step = 1; step <= 20; step += 1) {
    const t = step / 20
    const current = {
      x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
    }
    if (distanceToSegment(point, previous, current) <= padding) return true
    previous = current
  }
  return false
}

function distanceToSegment(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy })
}

function distance(a: CanvasPoint, b: CanvasPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function boundsContainPoint(bounds: ReturnType<typeof getShapeBounds>, point: CanvasPoint, padding: number) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding && point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding
}
