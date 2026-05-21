import type { CanvasPoint } from '@/features/canvas-engine'

type RoundedCorner = {
  end: CanvasPoint
  start: CanvasPoint
  vertex: CanvasPoint
}

export function getRoundedPolygonPath(points: readonly CanvasPoint[], radius: number) {
  if (points.length < 3 || radius <= 0) return getStraightPolygonPath(points)
  const corners = points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    return createRoundedCorner(previous, vertex, next, radius)
  })
  const firstMove = corners.at(-1)?.end ?? points[0]
  const segments = corners.map((corner) => (
    `L ${formatPoint(corner.start)} Q ${formatPoint(corner.vertex)} ${formatPoint(corner.end)}`
  ))
  return `M ${formatPoint(firstMove)} ${segments.join(' ')} Z`
}

function getStraightPolygonPath(points: readonly CanvasPoint[]) {
  if (points.length === 0) return ''
  return `M ${points.map(formatPoint).join(' L ')} Z`
}

function createRoundedCorner(previous: CanvasPoint, vertex: CanvasPoint, next: CanvasPoint, radius: number): RoundedCorner {
  const incoming = { x: previous.x - vertex.x, y: previous.y - vertex.y }
  const outgoing = { x: next.x - vertex.x, y: next.y - vertex.y }
  const incomingLength = getVectorLength(incoming)
  const outgoingLength = getVectorLength(outgoing)
  if (incomingLength === 0 || outgoingLength === 0) {
    return { end: vertex, start: vertex, vertex }
  }

  const incomingUnit = { x: incoming.x / incomingLength, y: incoming.y / incomingLength }
  const outgoingUnit = { x: outgoing.x / outgoingLength, y: outgoing.y / outgoingLength }
  const dot = clamp(incomingUnit.x * outgoingUnit.x + incomingUnit.y * outgoingUnit.y, -0.999_999, 0.999_999)
  const angle = Math.acos(dot)
  const tangentDistance = Math.min(
    radius / Math.tan(angle / 2),
    incomingLength / 2,
    outgoingLength / 2,
  )

  return {
    end: {
      x: vertex.x + outgoingUnit.x * tangentDistance,
      y: vertex.y + outgoingUnit.y * tangentDistance,
    },
    start: {
      x: vertex.x + incomingUnit.x * tangentDistance,
      y: vertex.y + incomingUnit.y * tangentDistance,
    },
    vertex,
  }
}

function getVectorLength(vector: CanvasPoint) {
  return Math.hypot(vector.x, vector.y)
}

function formatPoint(point: CanvasPoint) {
  return `${round(point.x)} ${round(point.y)}`
}

function round(value: number) {
  return Number(value.toFixed(3))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
