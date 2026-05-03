import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  withCanvasShapes,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasDocument,
} from '@/features/canvas-engine'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { createShapeDragPreview, createShapeDragPreviewFromOrigins, getShapeDragPreviewBounds, getShapeDragPreviewShapes, type KonvaShapeDragPreview } from './konvaDragPreview'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { applyFrameContainment } from './konvaFrameContainment'
import { appendShapes, cloneKonvaShapes } from './konvaShapeCommands'
import { snapBoundsToShapes, type KonvaSnapGuide } from './konvaSnapping'

type UseKonvaShapeDragHandlersOptions = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  documentRef: { current: CanvasDocument }
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaShapeDragHandlers(options: UseKonvaShapeDragHandlersOptions) {
  const { activeTool, camera, documentRef, onDocumentChange, onDocumentPreview, onHistoryCheckpoint, onSelectionChange, selectedIds } = options
  const snapAlignment = useCanvasSettingsStore((state) => state.settings.snapAlignment)
  const snapDistance = useCanvasSettingsStore((state) => state.settings.snapDistance)
  const dragRef = useRef<KonvaShapeDragPreview | null>(null)
  const [selectedBoundsOverride, setSelectedBoundsOverride] = useState<CanvasBounds | null>(null)
  const [snapGuides, setSnapGuides] = useState<KonvaSnapGuide[]>([])

  const getSnappedDragPoint = useCallback((drag: KonvaShapeDragPreview, x: number, y: number) => {
    if (!snapAlignment) {
      setSnapGuides([])
      return { x, y }
    }
    const rawBounds = getShapeDragPreviewBounds(drag, x, y)
    const threshold = snapDistance / Math.max(0.1, camera.zoom)
    const movingIds = drag.originShapes.map((shape) => shape.id)
    const result = snapBoundsToShapes(documentRef.current.shapes, movingIds, rawBounds, threshold)
    setSnapGuides(result.guides)
    return {
      x: x + result.bounds.minX - rawBounds.minX,
      y: y + result.bounds.minY - rawBounds.minY,
    }
  }, [camera.zoom, documentRef, snapAlignment, snapDistance])

  const handleShapeDragStart = useCallback((shapeId: string, config: { duplicate?: boolean } = {}) => {
    const current = documentRef.current
    const baseDragShapeIds = activeTool === 'select' && selectedIds.includes(shapeId) ? selectedIds : [shapeId]
    const dragShapeIds = expandFrameChildren(current.shapes, baseDragShapeIds)
    const sourceShapes = current.shapes.filter((shape) => dragShapeIds.includes(shape.id))
    const duplicateShapes = config.duplicate ? cloneKonvaShapes(sourceShapes, { x: 0, y: 0 }) : null
    const nextDocument = duplicateShapes ? appendShapes(current, duplicateShapes).document : current
    const originShape = current.shapes.find((shape) => shape.id === shapeId)
    const preview = duplicateShapes
      ? (originShape ? createShapeDragPreviewFromOrigins(originShape, duplicateShapes, shapeId) : null)
      : createShapeDragPreview(current.shapes, dragShapeIds, shapeId)
    if (!preview) return
    onHistoryCheckpoint(current)
    if (duplicateShapes) {
      documentRef.current = nextDocument
      onDocumentPreview(nextDocument)
      onSelectionChange(duplicateShapes.map((shape) => shape.id))
    }
    dragRef.current = preview
    return { lockSource: Boolean(duplicateShapes) }
  }, [activeTool, documentRef, onDocumentPreview, onHistoryCheckpoint, onSelectionChange, selectedIds])

  const handleShapeDragMove = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    if (!drag || drag.shapeId !== shapeId) return
    const nextPoint = getSnappedDragPoint(drag, x, y)
    setSelectedBoundsOverride(getShapeDragPreviewBounds(drag, nextPoint.x, nextPoint.y))
    const previewShapes = getShapeDragPreviewShapes(documentRef.current.shapes, drag, nextPoint.x, nextPoint.y)
    dragRef.current = { ...drag, previewShapes }
    const nextDocument = withCanvasShapes(documentRef.current, previewShapes)
    documentRef.current = nextDocument
    onDocumentPreview(nextDocument)
  }, [documentRef, getSnappedDragPoint, onDocumentPreview])

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    dragRef.current = null
    setSelectedBoundsOverride(null)
    setSnapGuides([])
    if (!drag || drag.shapeId !== shapeId) return
    const movedShapeIds = drag.originShapes.map((shape) => shape.id)
    const previewShapes = drag.previewShapes ?? getShapeDragPreviewShapes(documentRef.current.shapes, drag, x, y)
    const finalShapes = applyFrameContainment(previewShapes, movedShapeIds)
    onDocumentChange((current) => withCanvasShapes(current, finalShapes))
  }, [documentRef, onDocumentChange])

  return {
    handleShapeDragEnd,
    handleShapeDragMove,
    handleShapeDragStart,
    selectedBoundsOverride,
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
