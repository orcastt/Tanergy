import type { CanvasShape } from '@/features/canvas-engine'
import { canCanvasShapeFlip, canCanvasShapeRotate, canCanvasSelectionFlip, canCanvasSelectionRotate } from '@/features/canvas-engine'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

export function canKonvaShapeRotate(shape: CanvasShape) {
  return canCanvasShapeRotate(shape)
}

export function canKonvaShapeFlip(shape: CanvasShape) {
  return canCanvasShapeFlip(shape)
}

export function canKonvaSelectionRotate(shapes: CanvasShape[]) {
  return canCanvasSelectionRotate(shapes)
}

export function canKonvaSelectionFlip(shapes: CanvasShape[]) {
  return canCanvasSelectionFlip(shapes)
}

export function canKonvaShapeSelectWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  void shape
  return activeTool === 'select'
}

export function canKonvaShapeDragWithTool(shape: CanvasShape, activeTool: KonvaCanvasTool) {
  void shape
  return activeTool === 'select'
}
