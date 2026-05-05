import {
  boundsToRect,
  getShapeBounds,
  type CanvasBounds,
  type CanvasPoint,
  type CanvasShape,
} from '@/features/canvas-engine'
import type { KonvaResizeHandle } from './konvaCanvasTypes'
import { scaleStandaloneTextStyle } from './konvaTextAutoFit'

const minResizeSize = 12
type ResizableCanvasShape = Extract<CanvasShape, { props: { height: number; width: number } }>

export function getSelectedShapeBounds(shapes: CanvasShape[], selectedIds: string[]): CanvasBounds | null {
  const selected = new Set(selectedIds)
  const bounds = shapes.filter((shape) => selected.has(shape.id)).map(getShapeBounds)
  if (bounds.length === 0) return null
  return bounds.reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
}

export function getBoxSelectedIds(shapes: CanvasShape[], bounds: CanvasBounds) {
  return shapes
    .filter((shape) => boundsIntersect(getShapeBounds(shape), bounds))
    .map((shape) => shape.id)
}

export function getMarqueeSelectionIds(shapes: CanvasShape[], bounds: CanvasBounds, currentIds: string[], additive: boolean) {
  if (isTinyBounds(bounds)) return additive ? currentIds : []
  const selected = getBoxSelectedIds(shapes, bounds)
  return additive ? mergeSelectedIds(currentIds, selected) : selected
}

export function boundsFromPoints(a: CanvasPoint, b: CanvasPoint): CanvasBounds {
  return {
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
  }
}

export function isTinyBounds(bounds: CanvasBounds) {
  const rect = boundsToRect(bounds)
  return rect.width < 4 && rect.height < 4
}

export function isResizableShape(shape: CanvasShape): shape is ResizableCanvasShape {
  return 'width' in shape.props && 'height' in shape.props
}

export function getShapesByIds(shapes: CanvasShape[], shapeIds: string[]) {
  const selected = new Set(shapeIds)
  return shapes.filter((shape) => selected.has(shape.id))
}

export function toggleSelectedId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function mergeSelectedIds(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next]))
}

export function resizeShapeToBounds(shape: CanvasShape, bounds: CanvasBounds): CanvasShape {
  if (!isResizableShape(shape)) return shape
  const rect = boundsToRect(bounds)
  return {
    ...shape,
    props: {
      ...shape.props,
      height: Math.max(minResizeSize, rect.height),
      width: Math.max(minResizeSize, rect.width),
    },
    x: rect.x,
    y: rect.y,
  } as CanvasShape
}

export function resizeShapesFromBounds(
  shapes: CanvasShape[],
  originShapes: CanvasShape[],
  originBounds: CanvasBounds,
  nextBounds: CanvasBounds,
  options: { scaleText?: boolean } = {}
): CanvasShape[] {
  const originals = new Map(originShapes.map((shape) => [shape.id, shape]))
  return shapes.map((shape) => {
    const original = originals.get(shape.id)
    return original ? transformShapeFromBounds(original, originBounds, nextBounds, options) : shape
  })
}

export function resizeBoundsFromHandle(
  originBounds: CanvasBounds,
  handle: KonvaResizeHandle,
  point: CanvasPoint,
  options: { preserveAspect?: boolean } = {}
): CanvasBounds {
  if (isEdgeResizeHandle(handle)) return resizeBoundsFromEdgeHandle(originBounds, handle, point)
  const anchor = getOppositeCorner(originBounds, handle)
  const nextPoint = options.preserveAspect ? preserveAspectPoint(anchor, point, originBounds) : point
  return normalizeResizeBounds(boundsFromPoints(anchor, nextPoint))
}

export function preserveAspectResizeBoundsFromSnappedBounds(
  originBounds: CanvasBounds,
  handle: KonvaResizeHandle,
  snappedBounds: CanvasBounds,
  snapOrientations: Array<'horizontal' | 'rotation' | 'vertical'>
): CanvasBounds {
  const width = Math.max(1, originBounds.maxX - originBounds.minX)
  const height = Math.max(1, originBounds.maxY - originBounds.minY)
  const anchor = getOppositeCorner(originBounds, handle)
  const draggedPoint = getResizeHandlePoint(snappedBounds, handle)
  const xScale = Math.abs(draggedPoint.x - anchor.x) / width
  const yScale = Math.abs(draggedPoint.y - anchor.y) / height
  const hasXSnap = snapOrientations.includes('vertical')
  const hasYSnap = snapOrientations.includes('horizontal')
  const defaultXSign = handle === 'ne' || handle === 'se' ? 1 : -1
  const defaultYSign = handle === 'se' || handle === 'sw' ? 1 : -1
  const scale = Math.max(
    hasXSnap && !hasYSnap
      ? xScale
      : hasYSnap && !hasXSnap
        ? yScale
        : (xScale * width + yScale * height) / (width + height),
    minResizeSize / width,
    minResizeSize / height
  )
  return normalizeResizeBounds(boundsFromPoints(anchor, {
    x: anchor.x + (Math.sign(draggedPoint.x - anchor.x) || defaultXSign) * width * scale,
    y: anchor.y + (Math.sign(draggedPoint.y - anchor.y) || defaultYSign) * height * scale,
  }))
}

export function moveBounds(bounds: CanvasBounds, delta: CanvasPoint): CanvasBounds {
  return {
    maxX: bounds.maxX + delta.x,
    maxY: bounds.maxY + delta.y,
    minX: bounds.minX + delta.x,
    minY: bounds.minY + delta.y,
  }
}

export function moveShapesFromOrigins(shapes: CanvasShape[], originShapes: CanvasShape[], delta: CanvasPoint): CanvasShape[] {
  const originals = new Map(originShapes.map((shape) => [shape.id, shape]))
  return shapes.map((shape) => {
    const original = originals.get(shape.id)
    return original ? { ...original, x: original.x + delta.x, y: original.y + delta.y } : shape
  })
}

function boundsIntersect(a: CanvasBounds, b: CanvasBounds) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function getOppositeCorner(bounds: CanvasBounds, handle: KonvaResizeHandle): CanvasPoint {
  if (handle === 'nw') return { x: bounds.maxX, y: bounds.maxY }
  if (handle === 'ne') return { x: bounds.minX, y: bounds.maxY }
  if (handle === 'sw') return { x: bounds.maxX, y: bounds.minY }
  return { x: bounds.minX, y: bounds.minY }
}

function getResizeHandlePoint(bounds: CanvasBounds, handle: KonvaResizeHandle): CanvasPoint {
  if (handle === 'nw') return { x: bounds.minX, y: bounds.minY }
  if (handle === 'ne') return { x: bounds.maxX, y: bounds.minY }
  if (handle === 'sw') return { x: bounds.minX, y: bounds.maxY }
  return { x: bounds.maxX, y: bounds.maxY }
}

function isEdgeResizeHandle(handle: KonvaResizeHandle) {
  return handle === 'n' || handle === 'e' || handle === 's' || handle === 'w'
}

function resizeBoundsFromEdgeHandle(bounds: CanvasBounds, handle: KonvaResizeHandle, point: CanvasPoint): CanvasBounds {
  const next = { ...bounds }
  if (handle === 'n') next.minY = Math.min(point.y, bounds.maxY - minResizeSize)
  if (handle === 'e') next.maxX = Math.max(point.x, bounds.minX + minResizeSize)
  if (handle === 's') next.maxY = Math.max(point.y, bounds.minY + minResizeSize)
  if (handle === 'w') next.minX = Math.min(point.x, bounds.maxX - minResizeSize)
  return next
}

function normalizeResizeBounds(bounds: CanvasBounds): CanvasBounds {
  const rect = boundsToRect(bounds)
  if (rect.width >= minResizeSize && rect.height >= minResizeSize) return bounds
  return {
    maxX: rect.x + Math.max(minResizeSize, rect.width),
    maxY: rect.y + Math.max(minResizeSize, rect.height),
    minX: rect.x,
    minY: rect.y,
  }
}

function preserveAspectPoint(anchor: CanvasPoint, point: CanvasPoint, bounds: CanvasBounds): CanvasPoint {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  const defaultXSign = anchor.x <= bounds.minX ? 1 : -1
  const defaultYSign = anchor.y <= bounds.minY ? 1 : -1
  const diagonalScale = (Math.abs(dx) * width + Math.abs(dy) * height) / (width * width + height * height)
  const scale = Math.max(diagonalScale, minResizeSize / width, minResizeSize / height)
  return {
    x: anchor.x + (Math.sign(dx) || defaultXSign) * width * scale,
    y: anchor.y + (Math.sign(dy) || defaultYSign) * height * scale,
  }
}

function transformShapeFromBounds(shape: CanvasShape, originBounds: CanvasBounds, nextBounds: CanvasBounds, options: { scaleText?: boolean } = {}): CanvasShape {
  const scaleX = (nextBounds.maxX - nextBounds.minX) / Math.max(1, originBounds.maxX - originBounds.minX)
  const scaleY = (nextBounds.maxY - nextBounds.minY) / Math.max(1, originBounds.maxY - originBounds.minY)
  const nextPoint = (point: CanvasPoint): CanvasPoint => ({
    x: nextBounds.minX + (point.x - originBounds.minX) * scaleX,
    y: nextBounds.minY + (point.y - originBounds.minY) * scaleY,
  })
  const nextOrigin = nextPoint({ x: shape.x, y: shape.y })

  if (isResizableShape(shape)) {
    const scaledShape = shape.type === 'text' && options.scaleText !== false ? scaleStandaloneTextStyle(shape, scaleY) : shape
    return {
      ...scaledShape,
      props: {
        ...scaledShape.props,
        height: Math.max(minResizeSize, shape.props.height * scaleY),
        width: Math.max(minResizeSize, shape.props.width * scaleX),
      },
      x: nextOrigin.x,
      y: nextOrigin.y,
    } as CanvasShape
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    const toLocalPoint = (point: CanvasPoint) => {
      const next = nextPoint({ x: shape.x + point.x, y: shape.y + point.y })
      return { x: next.x - nextOrigin.x, y: next.y - nextOrigin.y }
    }
    return {
      ...shape,
      props: {
        ...shape.props,
        bends: shape.props.bends?.map(toLocalPoint),
        control: shape.props.control ? toLocalPoint(shape.props.control) : shape.props.control,
        end: toLocalPoint(shape.props.end),
      },
      x: nextOrigin.x,
      y: nextOrigin.y,
    }
  }

  if (shape.type === 'stroke') {
    return {
      ...shape,
      props: {
        points: shape.props.points.map((point) => ({ ...point, x: point.x * scaleX, y: point.y * scaleY })),
      },
      x: nextOrigin.x,
      y: nextOrigin.y,
    }
  }

  return shape
}
