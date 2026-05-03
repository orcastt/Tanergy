import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  withCanvasShapes,
  type CanvasBounds,
  type CanvasDocument,
} from '@/features/canvas-engine'
import { createShapeDragPreview, createShapeDragPreviewFromOrigins, getShapeDragPreviewBounds, getShapeDragPreviewShapes, type KonvaShapeDragPreview } from './konvaDragPreview'
import type { KonvaCanvasTool } from './konvaCanvasTypes'
import { appendShapes, cloneKonvaShapes } from './konvaShapeCommands'

type UseKonvaShapeDragHandlersOptions = {
  activeTool: KonvaCanvasTool
  documentRef: { current: CanvasDocument }
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaShapeDragHandlers(options: UseKonvaShapeDragHandlersOptions) {
  const { activeTool, documentRef, onDocumentChange, onDocumentPreview, onHistoryCheckpoint, onSelectionChange, selectedIds } = options
  const dragRef = useRef<KonvaShapeDragPreview | null>(null)
  const [selectedBoundsOverride, setSelectedBoundsOverride] = useState<CanvasBounds | null>(null)

  const handleShapeDragStart = useCallback((shapeId: string, config: { duplicate?: boolean } = {}) => {
    const current = documentRef.current
    const dragShapeIds = activeTool === 'select' ? selectedIds : [shapeId]
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
    setSelectedBoundsOverride(getShapeDragPreviewBounds(drag, x, y))
    const nextDocument = withCanvasShapes(documentRef.current, getShapeDragPreviewShapes(documentRef.current.shapes, drag, x, y))
    documentRef.current = nextDocument
    onDocumentPreview(nextDocument)
  }, [documentRef, onDocumentPreview])

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    const drag = dragRef.current
    dragRef.current = null
    setSelectedBoundsOverride(null)
    if (!drag || drag.shapeId !== shapeId) return
    onDocumentChange((current) => withCanvasShapes(current, getShapeDragPreviewShapes(current.shapes, drag, x, y)))
  }, [onDocumentChange])

  return {
    handleShapeDragEnd,
    handleShapeDragMove,
    handleShapeDragStart,
    selectedBoundsOverride,
    setSelectedBoundsOverride,
  }
}
