import type { CanvasDocument, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle } from './konvaCanvasTypes'

export function updateLineEndpointShapes(
  shapes: CanvasDocument['shapes'],
  originShape: Extract<CanvasShape, { type: 'arrow' | 'line' }>,
  endpoint: KonvaLineEndpointHandle,
  point: CanvasPoint,
  options: { lockAngle?: boolean } = {}
) {
  const start = { x: originShape.x, y: originShape.y }
  const end = { x: originShape.x + originShape.props.end.x, y: originShape.y + originShape.props.end.y }
  const nextPoint = options.lockAngle
    ? lockPointAngle(endpoint === 'start' ? end : start, point)
    : point

  return shapes.map((shape) => {
    if (shape.id !== originShape.id || (shape.type !== 'line' && shape.type !== 'arrow')) return shape
    if (endpoint === 'end') {
      return {
        ...shape,
        props: {
          ...shape.props,
          end: { x: nextPoint.x - originShape.x, y: nextPoint.y - originShape.y },
        },
      }
    }
    return {
      ...shape,
      props: {
        ...shape.props,
        end: { x: end.x - nextPoint.x, y: end.y - nextPoint.y },
      },
      x: nextPoint.x,
      y: nextPoint.y,
    }
  })
}

function lockPointAngle(anchor: CanvasPoint, point: CanvasPoint, stepDegrees = 15): CanvasPoint {
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return point
  const angle = Math.atan2(dy, dx)
  const step = stepDegrees * Math.PI / 180
  const locked = Math.round(angle / step) * step
  return {
    x: anchor.x + Math.cos(locked) * distance,
    y: anchor.y + Math.sin(locked) * distance,
  }
}
