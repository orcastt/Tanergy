import { withCanvasShapes, type CanvasDocument, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'

export type KonvaLineRoute = 'curve' | 'orthogonal' | 'straight'
export type KonvaLineShape = Extract<CanvasShape, { type: 'arrow' | 'line' }>

export const konvaLineRoutes: Array<{ icon: string; label: string; value: KonvaLineRoute }> = [
  { icon: 'style-icon--spline-line', label: 'Straight', value: 'straight' },
  { icon: 'style-icon--spline-cubic', label: 'Curve', value: 'curve' },
  { icon: 'style-icon--arrow-kind-elbow', label: 'Elbow', value: 'orthogonal' },
]

export function isKonvaLineShape(shape: CanvasShape): shape is KonvaLineShape {
  return shape.type === 'line' || shape.type === 'arrow'
}

export function getLineRoute(shape: KonvaLineShape): KonvaLineRoute {
  if (shape.props.route) return shape.props.route
  if (shape.props.bends && shape.props.bends.length >= 2) return 'orthogonal'
  if (shape.props.control) return 'curve'
  return 'straight'
}

export function getKonvaLineRouteSnapshot(shapes: CanvasShape[]): KonvaLineRoute | 'mixed' | null {
  const lineShapes = shapes.filter(isKonvaLineShape)
  if (lineShapes.length === 0) return null
  const first = getLineRoute(lineShapes[0])
  return lineShapes.every((shape) => getLineRoute(shape) === first) ? first : 'mixed'
}

export function applyKonvaLineRoute(document: CanvasDocument, shapeIds: string[], route: KonvaLineRoute): CanvasDocument {
  const selected = new Set(shapeIds)
  return withCanvasShapes(document, document.shapes.map((shape) => (
    selected.has(shape.id) && isKonvaLineShape(shape) ? setLineRoute(shape, route) : shape
  )))
}

export function setLineRoute(shape: KonvaLineShape, route: KonvaLineRoute): KonvaLineShape {
  if (route === 'curve') {
    return { ...shape, props: { ...shape.props, bends: undefined, control: shape.props.control ?? getDefaultCurveControl(shape.props.end), route } }
  }
  if (route === 'orthogonal') {
    return { ...shape, props: { ...shape.props, bends: getOrthogonalBends(shape), control: null, route } }
  }
  return { ...shape, props: { ...shape.props, bends: undefined, control: null, route } }
}

export function getLinePathData(shape: KonvaLineShape): string {
  const route = getLineRoute(shape)
  if (route === 'curve') {
    const control = shape.props.control ?? getDefaultCurveControl(shape.props.end)
    return `M 0 0 Q ${format(control.x)} ${format(control.y)} ${format(shape.props.end.x)} ${format(shape.props.end.y)}`
  }
  return getLineRoutePoints(shape).map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${format(point.x)} ${format(point.y)}`
  )).join(' ')
}

export function getLineRoutePoints(shape: KonvaLineShape): CanvasPoint[] {
  return getLineRoute(shape) === 'orthogonal'
    ? [{ x: 0, y: 0 }, ...getOrthogonalBends(shape), shape.props.end]
    : [{ x: 0, y: 0 }, shape.props.end]
}

export function getLineArrowHeadAnchor(shape: KonvaLineShape): CanvasPoint {
  if (getLineRoute(shape) === 'curve') return shape.props.control ?? getDefaultCurveControl(shape.props.end)
  const points = getLineRoutePoints(shape)
  return points[Math.max(0, points.length - 2)]
}

export function getLineControlPoint(shape: KonvaLineShape): CanvasPoint {
  return shape.props.control ?? getDefaultCurveControl(shape.props.end)
}

export function getOrthogonalBends(shape: KonvaLineShape): [CanvasPoint, CanvasPoint] {
  const bends = shape.props.bends
  if (bends && bends.length >= 2) return normalizeOrthogonalBends(shape.props.end, bends[0].x)
  return normalizeOrthogonalBends(shape.props.end, shape.props.end.x / 2)
}

export function normalizeOrthogonalBends(end: CanvasPoint, x: number): [CanvasPoint, CanvasPoint] {
  return [{ x, y: 0 }, { x, y: end.y }]
}

function getDefaultCurveControl(end: CanvasPoint): CanvasPoint {
  const perpendicular = { x: -end.y, y: end.x }
  const length = Math.max(1, Math.hypot(perpendicular.x, perpendicular.y))
  const offset = Math.min(80, Math.max(24, Math.hypot(end.x, end.y) * 0.18))
  return {
    x: end.x / 2 + perpendicular.x / length * offset,
    y: end.y / 2 + perpendicular.y / length * offset,
  }
}

function format(value: number) {
  return Number(value.toFixed(1))
}
