import { canCanvasShapeRotate, type CanvasBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { getKonvaShapeMinResizeSize } from './konvaNodeCardSizing'
import { getKonvaOrientedBounds } from './konvaOrientedBounds'
import { resizeBoundsFromHandle } from './konvaSelectionUtils'
import { scaleStandaloneTextStyle } from './konvaTextAutoFit'

const rotatedResizeThreshold = 0.1

export type KonvaRotatedResizeBox = {
  center: CanvasPoint
  localBounds: CanvasBounds
  rotation: number
}

export function createRotatedResizeBox(shapes: CanvasShape[]): KonvaRotatedResizeBox | null {
  if (shapes.length !== 1) return getKonvaOrientedBounds(shapes)
  const shape = shapes[0]
  if (!shape || !canCanvasShapeRotate(shape) || !isBoxCanvasShape(shape) || Math.abs(shape.rotation ?? 0) < rotatedResizeThreshold) return null
  return {
    center: { x: shape.x + shape.props.width / 2, y: shape.y + shape.props.height / 2 },
    localBounds: {
      maxX: shape.props.width / 2,
      maxY: shape.props.height / 2,
      minX: -shape.props.width / 2,
      minY: -shape.props.height / 2,
    },
    rotation: shape.rotation ?? 0,
  }
}

export function resizeShapesFromRotatedBox(
  shapes: CanvasShape[],
  originShapes: CanvasShape[],
  rotatedBox: KonvaRotatedResizeBox,
  handle: KonvaResizeHandle,
  worldPoint: CanvasPoint,
  options: { preserveAspect?: boolean; scaleText?: boolean } = {}
): CanvasShape[] {
  const localPoint = worldToLocalPoint(worldPoint, rotatedBox.center, rotatedBox.rotation)
  const nextBounds = resizeBoundsFromHandle(rotatedBox.localBounds, handle, localPoint, options)
  const originals = new Map(originShapes.map((shape) => [shape.id, shape]))
  return shapes.map((shape) => {
    const original = originals.get(shape.id)
    return original ? transformShapeFromRotatedBounds(original, rotatedBox, nextBounds, options) : shape
  })
}

function transformShapeFromRotatedBounds(shape: CanvasShape, rotatedBox: KonvaRotatedResizeBox, nextBounds: CanvasBounds, options: { scaleText?: boolean } = {}): CanvasShape {
  const transformPoint = (point: CanvasPoint) => transformWorldPoint(point, rotatedBox, nextBounds)

  if (isBoxCanvasShape(shape)) {
    const scale = getRotatedBoundsScale(rotatedBox.localBounds, nextBounds)
    const center = transformPoint({ x: shape.x + shape.props.width / 2, y: shape.y + shape.props.height / 2 })
    const minSize = getKonvaShapeMinResizeSize(shape)
    const width = Math.max(minSize.width, shape.props.width * Math.abs(scale.x))
    const height = Math.max(minSize.height, shape.props.height * Math.abs(scale.y))
    const scaledShape = shape.type === 'text' && options.scaleText !== false ? scaleStandaloneTextStyle(shape, scale.y) : shape
    return {
      ...scaledShape,
      props: { ...scaledShape.props, height, width },
      x: center.x - width / 2,
      y: center.y - height / 2,
    } as CanvasShape
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    const start = transformPoint({ x: shape.x, y: shape.y })
    const toLocal = (point: CanvasPoint) => {
      const next = transformPoint({ x: shape.x + point.x, y: shape.y + point.y })
      return { x: next.x - start.x, y: next.y - start.y }
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

  if (shape.type === 'stroke') {
    const origin = transformPoint({ x: shape.x, y: shape.y })
    return {
      ...shape,
      props: {
        ...shape.props,
        points: shape.props.points.map((point) => {
          const next = transformPoint({ x: shape.x + point.x, y: shape.y + point.y })
          return { ...point, x: next.x - origin.x, y: next.y - origin.y }
        }),
      },
      x: origin.x,
      y: origin.y,
    }
  }

  return shape
}

function transformWorldPoint(point: CanvasPoint, rotatedBox: KonvaRotatedResizeBox, nextBounds: CanvasBounds) {
  const local = worldToLocalPoint(point, rotatedBox.center, rotatedBox.rotation)
  const scale = getRotatedBoundsScale(rotatedBox.localBounds, nextBounds)
  return localToWorldPoint({
    x: nextBounds.minX + (local.x - rotatedBox.localBounds.minX) * scale.x,
    y: nextBounds.minY + (local.y - rotatedBox.localBounds.minY) * scale.y,
  }, rotatedBox.center, rotatedBox.rotation)
}

function getRotatedBoundsScale(originBounds: CanvasBounds, nextBounds: CanvasBounds) {
  return {
    x: (nextBounds.maxX - nextBounds.minX) / Math.max(1, originBounds.maxX - originBounds.minX),
    y: (nextBounds.maxY - nextBounds.minY) / Math.max(1, originBounds.maxY - originBounds.minY),
  }
}

function worldToLocalPoint(point: CanvasPoint, center: CanvasPoint, rotation: number): CanvasPoint {
  const radians = -rotation * Math.PI / 180
  return rotatePoint({ x: point.x - center.x, y: point.y - center.y }, radians)
}

function localToWorldPoint(point: CanvasPoint, center: CanvasPoint, rotation: number): CanvasPoint {
  const radians = rotation * Math.PI / 180
  const rotated = rotatePoint(point, radians)
  return { x: center.x + rotated.x, y: center.y + rotated.y }
}

function rotatePoint(point: CanvasPoint, radians: number): CanvasPoint {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}
