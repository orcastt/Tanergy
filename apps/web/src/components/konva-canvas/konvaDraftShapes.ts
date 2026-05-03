import {
  createPoint,
  distanceBetweenPoints,
  simplifyStrokePoints,
  smoothStrokePoints,
  type CanvasPoint,
  type CanvasShape,
  type StrokePoint,
} from '@/features/canvas-engine'
import type { KonvaCanvasTool, KonvaToolSession } from './konvaCanvasTypes'

const boxTools = new Set<KonvaCanvasTool>(['rect', 'diamond', 'ellipse', 'triangle', 'cloud'])

export function updateStrokeDraft(session: Extract<KonvaToolSession, { type: 'create' }>, point: StrokePoint): CanvasShape {
  if (session.draft.type !== 'stroke') return session.draft
  const rawPoints: StrokePoint[] = session.rawPoints ?? [{ ...session.origin, pressure: 0.62 }]
  const previous = rawPoints[rawPoints.length - 1]
  if (distanceBetweenPoints(previous, point) > 1.5) rawPoints.push(point)
  session.rawPoints = rawPoints
  return {
    ...session.draft,
    props: {
      points: rawPoints.map((rawPoint) => ({
        pressure: rawPoint.pressure ?? 0.5,
        x: rawPoint.x - session.origin.x,
        y: rawPoint.y - session.origin.y,
      })),
    },
  }
}

export function finalizeDraft(shape: CanvasShape): CanvasShape | null {
  if (shape.type === 'stroke') {
    if (shape.props.points.length < 2) return null
    const smoothed = smoothStrokePoints(shape.props.points, { pressureWeight: 0.25, radius: 1 })
    const points = simplifyStrokePoints(smoothed, { minDistance: 0.45, tolerance: 0.35 })
    return { ...shape, props: { points } }
  }
  if ('width' in shape.props && 'height' in shape.props && (shape.props.width < 6 || shape.props.height < 6)) return null
  if ((shape.type === 'line' || shape.type === 'arrow') && distanceBetweenPoints(createPoint(), shape.props.end) < 8) return null
  return shape
}

export function createDraftShape(tool: KonvaCanvasTool, origin: CanvasPoint, point: CanvasPoint): CanvasShape | null {
  if (tool === 'draw') {
    return { id: createShapeId('stroke'), props: { points: [{ x: 0, y: 0, pressure: 0.62 } as StrokePoint] }, style: baseStyle(2), type: 'stroke', x: origin.x, y: origin.y }
  }
  if (tool === 'line' || tool === 'arrow') {
    return { id: createShapeId(tool), props: { end: { x: point.x - origin.x, y: point.y - origin.y } }, style: baseStyle(2), type: tool, x: origin.x, y: origin.y }
  }
  if (!boxTools.has(tool)) return null
  const x = Math.min(origin.x, point.x)
  const y = Math.min(origin.y, point.y)
  const width = Math.abs(point.x - origin.x)
  const height = Math.abs(point.y - origin.y)
  return { id: createShapeId(tool), props: { height, width }, style: baseStyle(2), type: tool, x, y } as CanvasShape
}

export function createTextShape(point: CanvasPoint): CanvasShape {
  return { id: createShapeId('text'), props: { height: 56, text: 'Text', width: 180 }, style: baseStyle(2), type: 'text', x: point.x, y: point.y }
}

export function createStrokePoint(point: CanvasPoint, event: PointerEvent, previous?: StrokePoint): StrokePoint {
  if (event.pointerType === 'pen' && event.pressure > 0) {
    return { ...point, pressure: event.pressure, time: event.timeStamp }
  }

  const pressure = previous ? getVelocityPressure(previous, { ...point, time: event.timeStamp }) : 0.62
  return { ...point, pressure, time: event.timeStamp }
}

function baseStyle(strokeWidth: number) {
  return { fill: 'rgba(255, 255, 255, 0.82)', opacity: 1, stroke: '#243142', strokeWidth }
}

function getVelocityPressure(previous: StrokePoint, point: StrokePoint): number {
  const elapsed = Math.max(8, (point.time ?? 0) - (previous.time ?? 0))
  const speed = distanceBetweenPoints(previous, point) / elapsed
  const normalizedSpeed = clamp(speed / 1.2, 0, 1)
  return clamp(0.76 - normalizedSpeed * 0.42, 0.34, 0.76)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createShapeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
