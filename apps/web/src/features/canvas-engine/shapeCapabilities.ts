import type { CanvasShape } from './types'

export function canCanvasShapeRotate(shape: CanvasShape) {
  return shape.type !== 'node_card'
}

export function canCanvasShapeFlip(shape: CanvasShape) {
  return shape.type !== 'node_card'
}

export function canCanvasSelectionRotate(shapes: CanvasShape[]) {
  return shapes.length > 0 && shapes.every(canCanvasShapeRotate)
}

export function canCanvasSelectionFlip(shapes: CanvasShape[]) {
  return shapes.length > 0 && shapes.every(canCanvasShapeFlip)
}
