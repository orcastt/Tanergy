import type { CanvasDocument, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle, KonvaLineRouteHandle } from './konvaCanvasTypes'
import { getCurveControlFromHandlePoint, getLineRoute, getOrthogonalBends, normalizeOrthogonalBends } from './konvaLineRouteUtils'

export function updateLineEndpointShapes(
  shapes: CanvasDocument['shapes'],
  originShape: Extract<CanvasShape, { type: 'arrow' | 'line' }>,
  endpoint: KonvaLineEndpointHandle,
  point: CanvasPoint,
  options: { lockAngle?: boolean } = {}
) {
  const start = { x: originShape.x, y: originShape.y }
  const end = { x: originShape.x + originShape.props.end.x, y: originShape.y + originShape.props.end.y }
  const control = originShape.props.control ? { x: originShape.x + originShape.props.control.x, y: originShape.y + originShape.props.control.y } : null
  const bends = getOrthogonalBends(originShape).map((bend) => ({ x: originShape.x + bend.x, y: originShape.y + bend.y }))
  const nextPoint = options.lockAngle
    ? lockPointAngle(endpoint === 'start' ? end : start, point)
    : point

  return shapes.map((shape) => {
    if (shape.id !== originShape.id || (shape.type !== 'line' && shape.type !== 'arrow')) return shape
    if (endpoint === 'end') {
      const nextEnd = { x: nextPoint.x - originShape.x, y: nextPoint.y - originShape.y }
      return {
        ...shape,
        props: {
          ...shape.props,
          bends: getLineRoute(shape) === 'orthogonal' ? normalizeOrthogonalBends(nextEnd, getOrthogonalBends(shape)[0].x) : shape.props.bends,
          end: nextEnd,
        },
      }
    }
    const nextEnd = { x: end.x - nextPoint.x, y: end.y - nextPoint.y }
    return {
      ...shape,
      props: {
        ...shape.props,
        bends: getLineRoute(shape) === 'orthogonal' ? normalizeOrthogonalBends(nextEnd, bends[0].x - nextPoint.x) : shape.props.bends,
        control: control ? { x: control.x - nextPoint.x, y: control.y - nextPoint.y } : shape.props.control,
        end: nextEnd,
      },
      x: nextPoint.x,
      y: nextPoint.y,
    }
  })
}

export function updateLineRouteHandleShapes(
  shapes: CanvasDocument['shapes'],
  originShape: Extract<CanvasShape, { type: 'arrow' | 'line' }>,
  handle: KonvaLineRouteHandle,
  point: CanvasPoint
) {
  return shapes.map((shape) => {
    if (shape.id !== originShape.id || (shape.type !== 'line' && shape.type !== 'arrow')) return shape
    if (handle === 'control') {
      const handlePoint = { x: point.x - originShape.x, y: point.y - originShape.y }
      return {
        ...shape,
        props: {
          ...shape.props,
          bends: undefined,
          control: getCurveControlFromHandlePoint(originShape.props.end, handlePoint),
          route: 'curve' as const,
        },
      }
    }
    const x = point.x - originShape.x
    return {
      ...shape,
      props: {
        ...shape.props,
        bends: normalizeOrthogonalBends(originShape.props.end, x),
        control: null,
        route: 'orthogonal' as const,
      },
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
