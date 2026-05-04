import { getShapeBounds, withCanvasShapes, type CanvasDocument, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { resizeShapesFromBounds } from './konvaSelectionUtils'

export type KonvaAlignAction = 'bottom' | 'center-x' | 'center-y' | 'left' | 'right' | 'top'
export type KonvaDistributeAction = 'horizontal' | 'vertical'
export type KonvaFlipAction = 'horizontal' | 'vertical'
export type KonvaStretchAction = 'horizontal' | 'vertical'
export type KonvaTidyAction = 'column' | 'row'

const tidySpacing = 24

export function alignKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaAlignAction): CanvasDocument {
  if (shapeIds.length < 2) return document
  const selected = new Set(shapeIds)
  const selectedShapes = document.shapes.filter((shape) => selected.has(shape.id) && !shape.isLocked)
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

export function distributeKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaDistributeAction): CanvasDocument {
  const selectedShapes = getSelectedShapes(document.shapes, shapeIds)
  if (selectedShapes.length < 3) return document
  const axis = action === 'horizontal' ? 'x' : 'y'
  const sorted = sortShapesByAxis(selectedShapes, axis)
  const targetBounds = mergeShapeBounds(selectedShapes)
  const totalSize = sorted.reduce((total, shape) => total + getBoundsSize(getShapeBounds(shape), axis), 0)
  const span = axis === 'x' ? targetBounds.maxX - targetBounds.minX : targetBounds.maxY - targetBounds.minY
  const gap = (span - totalSize) / Math.max(1, sorted.length - 1)
  const deltas = new Map<string, CanvasPoint>()
  let cursor = axis === 'x' ? targetBounds.minX : targetBounds.minY

  for (const shape of sorted) {
    const bounds = getShapeBounds(shape)
    const delta = axis === 'x' ? { x: cursor - bounds.minX, y: 0 } : { x: 0, y: cursor - bounds.minY }
    deltas.set(shape.id, delta)
    cursor += getBoundsSize(bounds, axis) + gap
  }

  return moveDocumentShapes(document, deltas)
}

export function stretchKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaStretchAction): CanvasDocument {
  const selectedShapes = getSelectedShapes(document.shapes, shapeIds)
  if (selectedShapes.length < 2) return document
  const targetBounds = mergeShapeBounds(selectedShapes)
  const selected = new Set(selectedShapes.map((shape) => shape.id))
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (!selected.has(shape.id)) return shape
    const bounds = getShapeBounds(shape)
    const nextBounds = action === 'horizontal'
      ? { ...bounds, maxX: targetBounds.maxX, minX: targetBounds.minX }
      : { ...bounds, maxY: targetBounds.maxY, minY: targetBounds.minY }
    return resizeShapesFromBounds([shape], [shape], bounds, nextBounds)[0] ?? shape
  }))
}

export function flipKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaFlipAction): CanvasDocument {
  const selectedShapes = getSelectedShapes(document.shapes, shapeIds)
  if (selectedShapes.length === 0) return document
  const targetBounds = mergeShapeBounds(selectedShapes)
  const center = {
    x: (targetBounds.minX + targetBounds.maxX) / 2,
    y: (targetBounds.minY + targetBounds.maxY) / 2,
  }
  const selected = new Set(selectedShapes.map((shape) => shape.id))
  return withCanvasShapes(document, document.shapes.map((shape) => (
    selected.has(shape.id) ? flipShape(shape, center, action) : shape
  )))
}

export function tidyKonvaShapes(document: CanvasDocument, shapeIds: string[], action: KonvaTidyAction): CanvasDocument {
  const selectedShapes = getSelectedShapes(document.shapes, shapeIds)
  if (selectedShapes.length < 2) return document
  const axis = action === 'row' ? 'x' : 'y'
  const sorted = sortShapesByAxis(selectedShapes, axis)
  const targetBounds = mergeShapeBounds(selectedShapes)
  const crossCenter = axis === 'x'
    ? (targetBounds.minY + targetBounds.maxY) / 2
    : (targetBounds.minX + targetBounds.maxX) / 2
  const deltas = new Map<string, CanvasPoint>()
  let cursor = axis === 'x' ? targetBounds.minX : targetBounds.minY

  for (const shape of sorted) {
    const bounds = getShapeBounds(shape)
    const center = axis === 'x'
      ? (bounds.minY + bounds.maxY) / 2
      : (bounds.minX + bounds.maxX) / 2
    deltas.set(shape.id, axis === 'x'
      ? { x: cursor - bounds.minX, y: crossCenter - center }
      : { x: crossCenter - center, y: cursor - bounds.minY })
    cursor += getBoundsSize(bounds, axis) + tidySpacing
  }

  return moveDocumentShapes(document, deltas)
}

function mergeShapeBounds(shapes: CanvasShape[]) {
  return shapes.map(getShapeBounds).reduce((merged, bounds) => ({
    maxX: Math.max(merged.maxX, bounds.maxX),
    maxY: Math.max(merged.maxY, bounds.maxY),
    minX: Math.min(merged.minX, bounds.minX),
    minY: Math.min(merged.minY, bounds.minY),
  }))
}

function getSelectedShapes(shapes: CanvasShape[], shapeIds: string[]) {
  const selected = new Set(shapeIds)
  return shapes.filter((shape) => selected.has(shape.id) && !shape.isLocked)
}

function sortShapesByAxis(shapes: CanvasShape[], axis: 'x' | 'y') {
  return [...shapes].sort((a, b) => {
    const aBounds = getShapeBounds(a)
    const bBounds = getShapeBounds(b)
    return axis === 'x' ? aBounds.minX - bBounds.minX : aBounds.minY - bBounds.minY
  })
}

function getBoundsSize(bounds: ReturnType<typeof getShapeBounds>, axis: 'x' | 'y') {
  return axis === 'x' ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY
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

function moveDocumentShapes(document: CanvasDocument, deltas: Map<string, CanvasPoint>): CanvasDocument {
  return withCanvasShapes(document, document.shapes.map((shape) => {
    const delta = deltas.get(shape.id) ?? getParentFrameDelta(shape, deltas)
    return delta ? moveShape(shape, delta) : shape
  }))
}

function moveShape(shape: CanvasShape, delta: CanvasPoint): CanvasShape {
  if (delta.x === 0 && delta.y === 0) return shape
  return { ...shape, x: shape.x + delta.x, y: shape.y + delta.y }
}

function flipShape(shape: CanvasShape, center: CanvasPoint, action: KonvaFlipAction): CanvasShape {
  if (shape.type === 'line' || shape.type === 'arrow') return flipLineLikeShape(shape, center, action)
  if (shape.type === 'stroke') return flipStrokeShape(shape, center, action)
  const shapeCenter = getShapeCenter(shape)
  const nextCenter = mirrorPoint(shapeCenter, center, action)
  const width = 'width' in shape.props ? shape.props.width : 0
  const height = 'height' in shape.props ? shape.props.height : 0
  return {
    ...shape,
    flipX: action === 'horizontal' ? !shape.flipX : shape.flipX,
    flipY: action === 'vertical' ? !shape.flipY : shape.flipY,
    x: nextCenter.x - width / 2,
    y: nextCenter.y - height / 2,
  } as CanvasShape
}

function flipLineLikeShape(shape: Extract<CanvasShape, { type: 'arrow' | 'line' }>, center: CanvasPoint, action: KonvaFlipAction): CanvasShape {
  const start = mirrorPoint({ x: shape.x, y: shape.y }, center, action)
  const toLocal = (point: CanvasPoint) => {
    const mirrored = mirrorPoint({ x: shape.x + point.x, y: shape.y + point.y }, center, action)
    return { x: mirrored.x - start.x, y: mirrored.y - start.y }
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

function flipStrokeShape(shape: Extract<CanvasShape, { type: 'stroke' }>, center: CanvasPoint, action: KonvaFlipAction): CanvasShape {
  const nextOrigin = mirrorPoint({ x: shape.x, y: shape.y }, center, action)
  return {
    ...shape,
    props: {
      ...shape.props,
      points: shape.props.points.map((point) => {
        const mirrored = mirrorPoint({ x: shape.x + point.x, y: shape.y + point.y }, center, action)
        return { ...point, x: mirrored.x - nextOrigin.x, y: mirrored.y - nextOrigin.y }
      }),
    },
    x: nextOrigin.x,
    y: nextOrigin.y,
  }
}

function getShapeCenter(shape: CanvasShape): CanvasPoint {
  if ('width' in shape.props && 'height' in shape.props) {
    return { x: shape.x + shape.props.width / 2, y: shape.y + shape.props.height / 2 }
  }
  const bounds = getShapeBounds(shape)
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
}

function mirrorPoint(point: CanvasPoint, center: CanvasPoint, action: KonvaFlipAction): CanvasPoint {
  return action === 'horizontal'
    ? { x: center.x * 2 - point.x, y: point.y }
    : { x: point.x, y: center.y * 2 - point.y }
}
