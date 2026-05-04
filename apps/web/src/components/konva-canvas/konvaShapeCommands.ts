import { getShapeBounds, withCanvasShapes, type CanvasDocument, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'

const defaultPasteOffset = { x: 24, y: 24 }

export function copyKonvaShapes(document: CanvasDocument, shapeIds: string[]): CanvasShape[] {
  const selected = new Set(shapeIds)
  return cloneShapes(document.shapes.filter((shape) => selected.has(shape.id)), { preserveIds: true })
}

export function cloneKonvaShapes(shapes: CanvasShape[], offset: CanvasPoint = defaultPasteOffset): CanvasShape[] {
  return cloneShapes(shapes, { offset })
}

export function pasteKonvaShapes(document: CanvasDocument, clipboardShapes: CanvasShape[], center?: CanvasPoint) {
  if (clipboardShapes.length === 0) return { document, selectedIds: [] as string[] }
  const offset = center ? getCenteringOffset(clipboardShapes, center) : defaultPasteOffset
  const copies = cloneKonvaShapes(clipboardShapes, offset)
  return appendShapes(document, copies)
}

export function appendShapes(document: CanvasDocument, shapes: CanvasShape[]) {
  return {
    document: withCanvasShapes(document, [...document.shapes, ...shapes]),
    selectedIds: shapes.map((shape) => shape.id),
  }
}

export function updateTextShape(document: CanvasDocument, shapeId: string, text: string): CanvasDocument {
  return withCanvasShapes(document, document.shapes.map((shape) => (
    shape.id === shapeId && (shape.type === 'text' || shape.type === 'sticky' || isTextContainerShape(shape))
      ? { ...shape, props: { ...shape.props, text } }
      : shape.id === shapeId && shape.type === 'frame'
        ? { ...shape, props: { ...shape.props, title: text } }
      : shape
  )))
}

export function isTextContainerShape(shape: CanvasShape) {
  return shape.type === 'rect' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'cloud'
}

function cloneShapes(shapes: CanvasShape[], options: { offset?: CanvasPoint; preserveIds?: boolean }): CanvasShape[] {
  const idMap = new Map(shapes.map((shape) => [shape.id, options.preserveIds ? shape.id : createShapeId(shape.type)]))
  const groupMap = new Map(shapes
    .map((shape) => shape.groupId)
    .filter((groupId): groupId is string => Boolean(groupId))
    .map((groupId) => [groupId, options.preserveIds ? groupId : createShapeId('group')]))
  return shapes.map((shape) => {
    const copy = typeof structuredClone === 'function'
      ? structuredClone(shape) as CanvasShape
      : JSON.parse(JSON.stringify(shape)) as CanvasShape
    copy.id = idMap.get(shape.id) ?? copy.id
    copy.groupId = shape.groupId ? groupMap.get(shape.groupId) ?? null : shape.groupId
    copy.parentId = shape.parentId ? idMap.get(shape.parentId) ?? null : shape.parentId
    copy.x += options.offset?.x ?? 0
    copy.y += options.offset?.y ?? 0
    return copy
  })
}

function getCenteringOffset(shapes: CanvasShape[], center: CanvasPoint): CanvasPoint {
  const bounds = shapes.map(getShapeBounds).reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
  return {
    x: center.x - (bounds.minX + bounds.maxX) / 2,
    y: center.y - (bounds.minY + bounds.maxY) / 2,
  }
}

function createShapeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
