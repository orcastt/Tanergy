import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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
  const [dragPreviewShapes, setDragPreviewShapes] = useState<CanvasShape[] | null>(null)
  const [draggingShapeIds, setDraggingShapeIds] = useState<string[]>([])
  const [selectedBoundsOverride, setSelectedBoundsOverride] = useState<CanvasBounds | null>(null)
  const [snapGuides, setSnapGuides] = useState<KonvaSnapGuide[]>([])

  const getSnappedDragPoint = useCallback((drag: KonvaShapeDragSession, x: number, y: number) => {
    if (!snapAlignment) {
      setSnapGuides([])
      return { x, y }
    }
    const rawBounds = getShapeDragSessionBounds(drag, x, y)
    const threshold = snapDistance / Math.max(0.1, camera.zoom)
    const result = snapBoundsToTargetBounds(drag.snapTargetBounds, rawBounds, threshold)
    setSnapGuides(result.guides)
    return {
      x: x + result.bounds.minX - rawBounds.minX,
      y: y + result.bounds.minY - rawBounds.minY,
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
    const nextPoint = getSnappedDragPoint(drag, x, y)
    setSelectedBoundsOverride(drag.movingShapeIds.length > 1 ? getShapeDragSessionBounds(drag, nextPoint.x, nextPoint.y) : null)
    const previewShapes = getShapeDragSessionShapes(drag, nextPoint.x, nextPoint.y)
    setDragPreviewShapes(previewShapes)
    dragRef.current = { ...drag, lastPoint: nextPoint }
  }, [getSnappedDragPoint])

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    dragRef.current = null
    setSelectedBoundsOverride(null)
    setDragPreviewShapes(null)
    setDraggingShapeIds([])
    setSnapGuides([])
    if (!drag || (drag.shapeId !== shapeId && !drag.movingShapeIds.includes(shapeId))) return
    const finalPoint = drag.lastPoint ?? getSnappedDragPoint(drag, x, y)
    const previewShapes = getShapeDragSessionShapes(drag, finalPoint.x, finalPoint.y)
    const finalShapes = applyFrameContainment(previewShapes, drag.movingShapeIds)
    const finalDocument = withCanvasShapes(documentRef.current, finalShapes)
    documentRef.current = finalDocument
    onDocumentChange(finalDocument)
    if (drag.selectOnEndIds) onSelectionChange(drag.selectOnEndIds)
  }, [documentRef, getSnappedDragPoint, onDocumentChange, onSelectionChange])

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
