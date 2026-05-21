import type { CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import { canCanvasShapeRotate } from '@/features/canvas-engine'

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

export function rotateShapesAroundCenter(shapes: CanvasShape[], originShapes: CanvasShape[], center: CanvasPoint, deltaRotation: number): CanvasShape[] {
  const originals = new Map(originShapes.map((shape) => [shape.id, shape]))
  return shapes.map((shape) => {
    const original = originals.get(shape.id)
    return original ? rotateShapeAroundCenter(original, center, deltaRotation) : shape
  })
}

export function normalizeRotation(rotation: number) {
  const normalized = rotation % 360
  return normalized > 180 ? normalized - 360 : normalized < -180 ? normalized + 360 : normalized
}

export function rotatePointAroundCenter(point: CanvasPoint, center: CanvasPoint, rotation: number): CanvasPoint {
  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

function rotateShapeAroundCenter(shape: CanvasShape, center: CanvasPoint, deltaRotation: number): CanvasShape {
  if (!canCanvasShapeRotate(shape)) return shape
  if (isBoxCanvasShape(shape)) {
    const nextCenter = rotatePointAroundCenter(getShapeRotationCenter(shape), center, deltaRotation)
    return {
      ...shape,
      rotation: normalizeRotation((shape.rotation ?? 0) + deltaRotation),
      x: nextCenter.x - shape.props.width / 2,
      y: nextCenter.y - shape.props.height / 2,
    } as CanvasShape
  }

  if (shape.type === 'line' || shape.type === 'arrow') return rotateLineShape(shape, center, deltaRotation)
  if (shape.type === 'stroke') return rotateStrokeShape(shape, center, deltaRotation)
  return shape
}

function rotateLineShape(shape: Extract<CanvasShape, { type: 'arrow' | 'line' }>, center: CanvasPoint, deltaRotation: number): CanvasShape {
  const start = rotatePointAroundCenter({ x: shape.x, y: shape.y }, center, deltaRotation)
  const toLocal = (point: CanvasPoint) => {
    const rotated = rotatePointAroundCenter({ x: shape.x + point.x, y: shape.y + point.y }, center, deltaRotation)
    return { x: rotated.x - start.x, y: rotated.y - start.y }
  }
  return {
    ...shape,
    props: {
      ...shape.props,
      bends: shape.props.bends?.map(toLocal),
      control: shape.props.control ? toLocal(shape.props.control) : shape.props.control,
      end: toLocal(shape.props.end),
    },
    x: start.x,
    y: start.y,
  }
}

function rotateStrokeShape(shape: Extract<CanvasShape, { type: 'stroke' }>, center: CanvasPoint, deltaRotation: number): CanvasShape {
  const nextOrigin = rotatePointAroundCenter({ x: shape.x, y: shape.y }, center, deltaRotation)
  return {
    ...shape,
    props: {
      ...shape.props,
      points: shape.props.points.map((point) => {
        const rotated = rotatePointAroundCenter({ x: shape.x + point.x, y: shape.y + point.y }, center, deltaRotation)
        return { ...point, x: rotated.x - nextOrigin.x, y: rotated.y - nextOrigin.y }
      }),
    },
    x: nextOrigin.x,
    y: nextOrigin.y,
  }
}
