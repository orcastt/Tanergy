import type { CanvasPoint, CanvasShape } from '@/features/canvas-engine'

type BoxCanvasShape = Extract<CanvasShape, { props: { height: number; width: number } }>

export function isBoxCanvasShape(shape: CanvasShape): shape is BoxCanvasShape {
  return 'width' in shape.props && 'height' in shape.props
}

export function getShapeRotationCenter(shape: CanvasShape): CanvasPoint {
  return isBoxCanvasShape(shape)
    ? { x: shape.x + shape.props.width / 2, y: shape.y + shape.props.height / 2 }
    : { x: shape.x, y: shape.y }
}

export function getPointAngle(center: CanvasPoint, point: CanvasPoint) {
  return Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI
}

export function getRotatedShapes(shapes: CanvasShape[], shapeId: string, rotation: number): CanvasShape[] {
  return shapes.map((shape) => shape.id === shapeId ? { ...shape, rotation: normalizeRotation(rotation) } : shape)
}

export function normalizeRotation(rotation: number) {
  const normalized = rotation % 360
  return normalized > 180 ? normalized - 360 : normalized < -180 ? normalized + 360 : normalized
}
