import { withCanvasShapes, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'

export function getKonvaGroupMemberIds(shapes: CanvasShape[], shapeId: string): string[] {
  const shape = shapes.find((item) => item.id === shapeId)
  if (!shape?.groupId) return shape ? [shape.id] : []
  return shapes.filter((item) => item.groupId === shape.groupId).map((item) => item.id)
}

export function expandKonvaGroupedShapeIds(shapes: CanvasShape[], shapeIds: string[]) {
  const expanded = new Set(shapeIds)
  for (const shapeId of shapeIds) {
    for (const id of getKonvaGroupMemberIds(shapes, shapeId)) expanded.add(id)
  }
  return [...expanded]
}

export function hasKonvaGroupedSelection(shapes: CanvasShape[], shapeIds: string[]) {
  const selected = new Set(shapeIds)
  return shapes.some((shape) => selected.has(shape.id) && Boolean(shape.groupId))
}

export function groupKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  const selectedIds = expandKonvaGroupedShapeIds(document.shapes, shapeIds)
  if (selectedIds.length < 2) return { document, selectedIds: shapeIds }
  const selected = new Set(selectedIds)
  const groupId = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return {
    document: withCanvasShapes(document, document.shapes.map((shape) => (
      selected.has(shape.id) ? { ...shape, groupId } : shape
    ))),
    selectedIds,
  }
}

export function ungroupKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  const groupIds = new Set(document.shapes
    .filter((shape) => shapeIds.includes(shape.id) && shape.groupId)
    .map((shape) => shape.groupId!))
  if (groupIds.size === 0) return { document, selectedIds: shapeIds }
  const selectedIds = document.shapes.filter((shape) => shape.groupId && groupIds.has(shape.groupId)).map((shape) => shape.id)
  return {
    document: withCanvasShapes(document, document.shapes.map((shape) => (
      shape.groupId && groupIds.has(shape.groupId) ? { ...shape, groupId: null } : shape
    ))),
    selectedIds,
  }
}

export function setKonvaShapesLocked(document: CanvasDocument, shapeIds: string[], isLocked: boolean) {
  const selectedIds = expandKonvaGroupedShapeIds(document.shapes, shapeIds)
  const selected = new Set(selectedIds)
  return {
    document: withCanvasShapes(document, document.shapes.map((shape) => (
      selected.has(shape.id) ? { ...shape, isLocked } : shape
    ))),
    selectedIds,
  }
}

export function lockKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  const expandedIds = expandKonvaGroupedShapeIds(document.shapes, shapeIds)
  if (expandedIds.length === 0) return { document, selectedIds: shapeIds }
  const grouped = shouldCreateLockedGroup(document.shapes, expandedIds)
    ? groupKonvaShapes(document, expandedIds)
    : { document, selectedIds: expandedIds }
  return setKonvaShapesLocked(grouped.document, grouped.selectedIds, true)
}

export function unlockKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  return setKonvaShapesLocked(document, shapeIds, false)
}

function shouldCreateLockedGroup(shapes: CanvasShape[], shapeIds: string[]) {
  if (shapeIds.length < 2) return false
  const selected = shapes.filter((shape) => shapeIds.includes(shape.id))
  if (selected.length < 2) return false
  const groupIds = new Set(selected.map((shape) => shape.groupId ?? shape.id))
  return groupIds.size > 1
}
