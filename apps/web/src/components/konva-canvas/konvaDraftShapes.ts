import {
  createPoint,
  distanceBetweenPoints,
  simplifyStrokePoints,
  smoothStrokePoints,
  type CanvasPoint,
  type CanvasShape,
  type CanvasShapeStyle,
  type StrokePoint,
} from '@/features/canvas-engine'
import type { KonvaCanvasTool, KonvaToolSession } from './konvaCanvasTypes'
import { resolveKonvaShapeStyle } from './konvaCanvasStyle'

const boxTools = new Set<KonvaCanvasTool>(['rect', 'diamond', 'ellipse', 'triangle', 'cloud', 'frame', 'sticky'])

export function updateStrokeDraft(session: Extract<KonvaToolSession, { type: 'create' }>, point: StrokePoint): CanvasShape {
  if (session.draft.type !== 'stroke') return session.draft
  const rawPoints: StrokePoint[] = session.rawPoints ?? [{ ...session.origin, pressure: 0.82 }]
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

export function createDraftShape(
  tool: KonvaCanvasTool,
  origin: CanvasPoint,
  point: CanvasPoint,
  options: { constrainProportions?: boolean; style?: CanvasShapeStyle } = {}
): CanvasShape | null {
  if (tool === 'draw') {
    return { id: createShapeId('stroke'), props: { points: [{ x: 0, y: 0, pressure: 0.82 } as StrokePoint] }, style: baseStyle(options.style), type: 'stroke', x: origin.x, y: origin.y }
  }
  if (tool === 'line' || tool === 'arrow') {
    return { id: createShapeId(tool), props: { end: { x: point.x - origin.x, y: point.y - origin.y } }, style: baseStyle(options.style), type: tool, x: origin.x, y: origin.y }
  }
  if (!boxTools.has(tool)) return null
  const end = options.constrainProportions ? constrainToSquare(origin, point) : point
  const x = Math.min(origin.x, end.x)
  const y = Math.min(origin.y, end.y)
  const width = Math.abs(end.x - origin.x)
  const height = Math.abs(end.y - origin.y)
  if (tool === 'frame') return { id: createShapeId('frame'), props: { height, title: 'Frame', width }, style: frameStyle(), type: 'frame', x, y }
  if (tool === 'sticky') return { id: createShapeId('sticky'), props: { authorName: 'You', height, text: 'Sticky', width }, style: stickyStyle(options.style), type: 'sticky', x, y }
  return { id: createShapeId(tool), props: { height, width }, style: baseStyle(options.style), type: tool, x, y } as CanvasShape
}

export function createTextShape(point: CanvasPoint, style?: CanvasShapeStyle): CanvasShape {
  return { id: createShapeId('text'), props: { height: 56, text: 'Text', width: 180 }, style: baseStyle(style), type: 'text', x: point.x, y: point.y }
}

export function createStrokePoint(point: CanvasPoint, event: PointerEvent, previous?: StrokePoint): StrokePoint {
  if (event.pointerType === 'pen' && event.pressure > 0) {
    return { ...point, pressure: event.pressure, time: event.timeStamp }
  }

  const pressure = previous ? getVelocityPressure(previous, { ...point, time: event.timeStamp }) : 0.82
  return { ...point, pressure, time: event.timeStamp }
}

export function createStrokeEndPoint(point: CanvasPoint, event: PointerEvent): StrokePoint {
  return { ...point, pressure: event.pointerType === 'pen' && event.pressure > 0 ? Math.max(0.78, event.pressure) : 0.84, time: event.timeStamp }
}

function baseStyle(style?: CanvasShapeStyle) {
  return resolveKonvaShapeStyle(style)
}

function frameStyle() {
  return { dash: 'solid' as const, fillStyle: 'solid' as const, opacity: 1, stroke: '#1f1f1f', strokeWidth: 1 }
}

function stickyStyle(style?: CanvasShapeStyle) {
  const stroke = style?.stroke && style.stroke !== '#243142' ? style.stroke : '#c084fc'
  return { ...baseStyle({ ...style, fillStyle: 'solid', stroke }) }
}

function constrainToSquare(origin: CanvasPoint, point: CanvasPoint): CanvasPoint {
  const width = point.x - origin.x
  const height = point.y - origin.y
  const size = Math.max(Math.abs(width), Math.abs(height))
  return {
    x: origin.x + Math.sign(width || 1) * size,
    y: origin.y + Math.sign(height || 1) * size,
  }
}

function getVelocityPressure(previous: StrokePoint, point: StrokePoint): number {
  const elapsed = Math.max(8, (point.time ?? 0) - (previous.time ?? 0))
  const speed = distanceBetweenPoints(previous, point) / elapsed
  const normalizedSpeed = clamp(speed / 1.2, 0, 1)
  return clamp(0.84 - normalizedSpeed * 0.5, 0.34, 0.84)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createShapeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
