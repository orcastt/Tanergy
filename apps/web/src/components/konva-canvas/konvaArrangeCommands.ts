import { getShapeBounds, withCanvasShapes, type CanvasDocument, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'

export type KonvaAlignAction = 'bottom' | 'center-x' | 'center-y' | 'left' | 'right' | 'top'

export function alignKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaAlignAction): CanvasDocument {
  if (shapeIds.length < 2) return document
  const selected = new Set(shapeIds)
  const selectedShapes = document.shapes.filter((shape) => selected.has(shape.id))
  if (selectedShapes.length < 2) return document
  const targetBounds = mergeShapeBounds(selectedShapes)
  const deltas = new Map<string, CanvasPoint>()

  for (const shape of selectedShapes) {
    deltas.set(shape.id, getAlignDelta(getShapeBounds(shape), targetBounds, action))
  }

  return withCanvasShapes(document, document.shapes.map((shape) => {
    const delta = deltas.get(shape.id) ?? getParentFrameDelta(shape, deltas)
    return delta ? moveShape(shape, delta) : shape
  }))
}

function mergeShapeBounds(shapes: CanvasShape[]) {
  return shapes.map(getShapeBounds).reduce((merged, bounds) => ({
    maxX: Math.max(merged.maxX, bounds.maxX),
    maxY: Math.max(merged.maxY, bounds.maxY),
    minX: Math.min(merged.minX, bounds.minX),
    minY: Math.min(merged.minY, bounds.minY),
  }))
}

function getAlignDelta(bounds: ReturnType<typeof getShapeBounds>, targetBounds: ReturnType<typeof getShapeBounds>, action: KonvaAlignAction): CanvasPoint {
  const targetCenterX = (targetBounds.minX + targetBounds.maxX) / 2
  const targetCenterY = (targetBounds.minY + targetBounds.maxY) / 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  if (action === 'left') return { x: targetBounds.minX - bounds.minX, y: 0 }
  if (action === 'center-x') return { x: targetCenterX - centerX, y: 0 }
  if (action === 'right') return { x: targetBounds.maxX - bounds.maxX, y: 0 }
  if (action === 'top') return { x: 0, y: targetBounds.minY - bounds.minY }
  if (action === 'center-y') return { x: 0, y: targetCenterY - centerY }
  return { x: 0, y: targetBounds.maxY - bounds.maxY }
}

function getParentFrameDelta(shape: CanvasShape, deltas: Map<string, CanvasPoint>): CanvasPoint | null {
  return shape.parentId ? deltas.get(shape.parentId) ?? null : null
}

function moveShape(shape: CanvasShape, delta: CanvasPoint): CanvasShape {
  if (delta.x === 0 && delta.y === 0) return shape
  return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y }
}
