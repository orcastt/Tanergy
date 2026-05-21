import {
  getShapeBounds,
  type CanvasBounds,
  type CanvasDocument,
  type CanvasNodeShape,
  type CanvasShape,
} from '@/features/canvas-engine'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'

export type KonvaRemoteMovePreview = {
  edges: CanvasDocument['runtimeEdges']
  key: string
  nodeShapes: CanvasNodeShape[]
  shapeIds: string[]
  shapes: CanvasShape[]
}

type CreateKonvaRemoteMovePreviewsOptions = {
  activePageId?: string | null
  document: CanvasDocument
  sessions?: readonly BoardCollaborationSessionRecord[]
}

export function createKonvaRemoteMovePreviews({
  activePageId = null,
  document,
  sessions = [],
}: CreateKonvaRemoteMovePreviewsOptions): KonvaRemoteMovePreview[] {
  return sessions.flatMap((session) => {
    if (session.isSelf || session.presence.transformKind !== 'move') return []
    if (!isSessionVisibleOnPage(activePageId, session.presence.activePageId ?? null)) return []
    const transformBox = session.presence.transformBox
    if (!transformBox) return []
    const shapeIds = normalizeShapeIds(session.presence.selectionIds ?? [])
    if (shapeIds.length === 0) return []
    const shapeIdSet = new Set(shapeIds)
    const sourceShapes = document.shapes.filter((shape) => shapeIdSet.has(shape.id))
    if (sourceShapes.length === 0) return []
    const sourceBounds = mergeBounds(sourceShapes.map(getShapeBounds))
    const delta = {
      x: transformBox.minX - sourceBounds.minX,
      y: transformBox.minY - sourceBounds.minY,
    }
    const previewShapes = sourceShapes.map((shape) => moveShape(shape, delta.x, delta.y))
    const movedShapeById = new Map(previewShapes.map((shape) => [shape.id, shape]))
    const nodeShapes = document.shapes
      .map((shape) => movedShapeById.get(shape.id) ?? shape)
      .filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')
    const edges = document.runtimeEdges.filter((edge) => (
      shapeIdSet.has(edge.sourceShapeId) || shapeIdSet.has(edge.targetShapeId)
    ))
    return [{
      edges,
      key: `${session.id}:remote-move`,
      nodeShapes,
      shapeIds,
      shapes: previewShapes,
    }]
  })
}

export function getKonvaRemoteMoveHiddenShapeIds(previews: readonly KonvaRemoteMovePreview[]) {
  return new Set(previews.flatMap((preview) => preview.shapeIds))
}

function normalizeShapeIds(shapeIds: readonly string[]) {
  const seen = new Set<string>()
  for (const shapeId of shapeIds) {
    const trimmed = shapeId.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
  }
  return [...seen]
}

function moveShape<T extends CanvasShape>(shape: T, deltaX: number, deltaY: number): T {
  return {
    ...shape,
    x: shape.x + deltaX,
    y: shape.y + deltaY,
  }
}

function isSessionVisibleOnPage(activePageId: string | null, sessionPageId: string | null) {
  if (!activePageId || !sessionPageId) return true
  return sessionPageId === activePageId
}

function mergeBounds(bounds: CanvasBounds[]) {
  return bounds.reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
}
