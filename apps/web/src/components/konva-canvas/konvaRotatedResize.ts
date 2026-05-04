import { boundsToRect, type CanvasBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { isBoxCanvasShape } from './konvaRotationUtils'
import { resizeBoundsFromHandle } from './konvaSelectionUtils'

const rotatedResizeThreshold = 0.1

export type KonvaRotatedResizeBox = {
  center: CanvasPoint
  localBounds: CanvasBounds
  rotation: number
}

export function createRotatedResizeBox(shapes: CanvasShape[]): KonvaRotatedResizeBox | null {
  if (shapes.length !== 1) return null
  const shape = shapes[0]
  if (!shape || !isBoxCanvasShape(shape) || Math.abs(shape.rotation ?? 0) < rotatedResizeThreshold) return null
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
  originShape: CanvasShape,
  rotatedBox: KonvaRotatedResizeBox,
  handle: KonvaResizeHandle,
  worldPoint: CanvasPoint,
  options: { preserveAspect?: boolean } = {}
): CanvasShape[] {
  if (!isBoxCanvasShape(originShape)) return shapes
  const localPoint = worldToLocalPoint(worldPoint, rotatedBox.center, rotatedBox.rotation)
  const nextBounds = resizeBoundsFromHandle(rotatedBox.localBounds, handle, localPoint, options)
  const rect = boundsToRect(nextBounds)
  const localCenter = {
    x: nextBounds.minX + rect.width / 2,
    y: nextBounds.minY + rect.height / 2,
  }
  const center = localToWorldPoint(localCenter, rotatedBox.center, rotatedBox.rotation)

  return shapes.map((shape) => shape.id === originShape.id
    ? {
        ...shape,
        props: {
          ...shape.props,
          height: Math.max(12, rect.height),
          width: Math.max(12, rect.width),
        },
        x: center.x - Math.max(12, rect.width) / 2,
        y: center.y - Math.max(12, rect.height) / 2,
      } as CanvasShape
    : shape)
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
