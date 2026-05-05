import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  withCanvasShapes,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasShape,
} from '@/features/canvas-engine'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { createDuplicateDragSession, createMoveDragSession, getShapeDragSessionBounds, getShapeDragSessionShapes, type KonvaShapeDragSession } from './konvaDragSession'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { applyFrameContainment } from './konvaFrameContainment'
import { expandKonvaGroupedShapeIds } from './konvaGroupCommands'
import { appendShapes, cloneKonvaShapes } from './konvaShapeCommands'
import { snapBoundsToTargetBounds, type KonvaSnapGuide } from './konvaSnapping'

type UseKonvaShapeDragHandlersOptions = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  documentRef: { current: CanvasDocument }
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaShapeDragHandlers(options: UseKonvaShapeDragHandlersOptions) {
  const { camera, documentRef, onDocumentChange, onHistoryCheckpoint, onSelectionChange, selectedIds } = options
  const snapAlignment = useCanvasSettingsStore((state) => state.settings.snapAlignment)
  const snapDistance = useCanvasSettingsStore((state) => state.settings.snapDistance)
  const dragRef = useRef<KonvaShapeDragSession | null>(null)
  const dragPreviewFrameRef = useRef<number | null>(null)
  const pendingDragPreviewRef = useRef<DragPreviewState | null>(null)
  const [dragPreviewShapes, setDragPreviewShapes] = useState<CanvasShape[] | null>(null)
  const [draggingShapeIds, setDraggingShapeIds] = useState<string[]>([])
  const [selectedBoundsOverride, setSelectedBoundsOverride] = useState<CanvasBounds | null>(null)
  const [snapGuides, setSnapGuides] = useState<KonvaSnapGuide[]>([])

  const publishDragPreview = useCallback((preview: DragPreviewState) => {
    pendingDragPreviewRef.current = preview
    if (dragPreviewFrameRef.current !== null) return
    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null
      const pending = pendingDragPreviewRef.current
      pendingDragPreviewRef.current = null
      if (!pending) return
      setSelectedBoundsOverride(pending.bounds)
      setDragPreviewShapes(pending.shapes)
      setSnapGuides(pending.guides)
    })
  }, [])

  const clearPendingDragPreview = useCallback(() => {
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current)
      dragPreviewFrameRef.current = null
    }
    pendingDragPreviewRef.current = null
  }, [])

  useEffect(() => () => clearPendingDragPreview(), [clearPendingDragPreview])

  const getSnappedDragPoint = useCallback((drag: KonvaShapeDragSession, x: number, y: number) => {
    if (!snapAlignment) {
      return { guides: [], point: { x, y } }
    }
    const rawBounds = getShapeDragSessionBounds(drag, x, y)
    const threshold = snapDistance / Math.max(0.1, camera.zoom)
    const result = snapBoundsToTargetBounds(drag.snapTargetBounds, rawBounds, threshold)
    return {
      guides: result.guides,
      point: {
        x: x + result.bounds.minX - rawBounds.minX,
        y: y + result.bounds.minY - rawBounds.minY,
      },
    }
  }, [camera.zoom, snapAlignment, snapDistance])

  const handleShapeDragStart = useCallback((shapeId: string, config: { duplicate?: boolean } = {}) => {
    const current = documentRef.current
    const baseDragShapeIds = selectedIds.includes(shapeId) ? selectedIds : [shapeId]
    const groupedShapeIds = expandKonvaGroupedShapeIds(current.shapes, baseDragShapeIds)
    const dragShapeIds = expandKonvaGroupedShapeIds(current.shapes, expandFrameChildren(current.shapes, groupedShapeIds))
    const sourceShapes = current.shapes.filter((shape) => dragShapeIds.includes(shape.id))
    if (sourceShapes.some((shape) => shape.isLocked)) return { lockSource: true }
    const duplicateShapes = config.duplicate ? cloneKonvaShapes(sourceShapes, { x: 0, y: 0 }) : null
    const nextDocument = duplicateShapes ? appendShapes(current, duplicateShapes).document : current
    const session = duplicateShapes
      ? createDuplicateDragSession({
          baseShapes: nextDocument.shapes,
          duplicateShapes,
          shapeId,
          sourceShapes,
          snapTargetShapes: current.shapes.filter((shape) => !dragShapeIds.includes(shape.id)),
        })
      : createMoveDragSession(current.shapes, dragShapeIds, shapeId)
    if (!session) return
    onHistoryCheckpoint(current)
    if (duplicateShapes) onSelectionChange(duplicateShapes.map((shape) => shape.id))
    dragRef.current = session
    setDraggingShapeIds(session.movingShapeIds)
    setDragPreviewShapes(getShapeDragSessionShapes(session, session.anchorShape.x, session.anchorShape.y))
    return { lockSource: true }
  }, [documentRef, onHistoryCheckpoint, onSelectionChange, selectedIds])

  const handleShapeDragMove = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    if (!drag || drag.shapeId !== shapeId) return
    const { guides, point } = getSnappedDragPoint(drag, x, y)
    publishDragPreview({
      bounds: drag.movingShapeIds.length > 1 ? getShapeDragSessionBounds(drag, point.x, point.y) : null,
      guides,
      shapes: getShapeDragSessionShapes(drag, point.x, point.y),
    })
    dragRef.current = { ...drag, lastPoint: point }
  }, [getSnappedDragPoint, publishDragPreview])

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    dragRef.current = null
    clearPendingDragPreview()
    setSelectedBoundsOverride(null)
    setDragPreviewShapes(null)
    setDraggingShapeIds([])
    setSnapGuides([])
    if (!drag || (drag.shapeId !== shapeId && !drag.movingShapeIds.includes(shapeId))) return
    const finalPoint = drag.lastPoint ?? getSnappedDragPoint(drag, x, y).point
    const previewShapes = getShapeDragSessionShapes(drag, finalPoint.x, finalPoint.y)
    const finalShapes = applyFrameContainment(previewShapes, drag.movingShapeIds)
    const finalDocument = withCanvasShapes(documentRef.current, finalShapes)
    documentRef.current = finalDocument
    onDocumentChange(finalDocument)
    if (drag.selectOnEndIds) onSelectionChange(drag.selectOnEndIds)
  }, [clearPendingDragPreview, documentRef, getSnappedDragPoint, onDocumentChange, onSelectionChange])

  return {
    handleShapeDragEnd,
    handleShapeDragMove,
    handleShapeDragStart,
    selectedBoundsOverride,
    dragPreviewShapes,
    draggingShapeIds,
    setSelectedBoundsOverride,
    snapGuides,
  }
}

type DragPreviewState = {
  bounds: CanvasBounds | null
  guides: KonvaSnapGuide[]
  shapes: CanvasShape[]
}

function expandFrameChildren(shapes: CanvasDocument['shapes'], shapeIds: string[]) {
  const expanded = new Set(shapeIds)
  let changed = true
  while (changed) {
    changed = false
    for (const shape of shapes) {
      if (shape.parentId && expanded.has(shape.parentId) && !expanded.has(shape.id)) {
        expanded.add(shape.id)
        changed = true
      }
    }
  }
  return [...expanded]
}
