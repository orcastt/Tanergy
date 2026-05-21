'use client'

import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { canCropKonvaImageSelection, getCropImageIdForSelection } from './konvaImageCropCommands'
import { hasKonvaGroupedSelection } from './konvaGroupCommands'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

type UseKonvaCanvasSelectionSaveStateOptions = {
  boardId: string
  document: CanvasDocument
  handleToolChange: (tool: KonvaCanvasTool) => void
  markBoardSavedAt: (savedAt: string) => void
  onBoardLoaded?: (title: string) => void
  onBoardSaved?: (board: BoardPersistenceSummary) => void
  requestFocusedEditShape: (shapeId: string, targetLabel: string) => boolean
  selectedIds: string[]
  setCropEditingImageId: Dispatch<SetStateAction<string | null>>
  setPersistedBoardIds: Dispatch<SetStateAction<Record<string, true>>>
}

export function useKonvaCanvasSelectionSaveState({
  boardId,
  document,
  handleToolChange,
  markBoardSavedAt,
  onBoardLoaded,
  onBoardSaved,
  requestFocusedEditShape,
  selectedIds,
  setCropEditingImageId,
  setPersistedBoardIds,
}: UseKonvaCanvasSelectionSaveStateOptions) {
  const pointCount = useMemo(() => (
    document.shapes.reduce((total, shape) => total + (shape.type === 'stroke' ? shape.props.points.length : 0), 0)
  ), [document.shapes])

  const selectedShapes = useMemo(() => {
    const selected = new Set(selectedIds)
    return document.shapes.filter((shape) => selected.has(shape.id))
  }, [document.shapes, selectedIds])

  const canLockSelection = selectedShapes.some((shape) => !shape.isLocked)
  const canGroupSelection = selectedIds.length > 1
  const canUngroupSelection = hasKonvaGroupedSelection(document.shapes, selectedIds)
  const canUnlockSelection = selectedShapes.some((shape) => shape.isLocked)
  const canCropImage = canCropKonvaImageSelection(document, selectedIds)

  const cropImage = useCallback(() => {
    const imageId = getCropImageIdForSelection(document, selectedIds)
    if (!imageId) return
    if (!requestFocusedEditShape(imageId, 'image')) return
    setCropEditingImageId((current) => (current === imageId ? null : imageId))
    handleToolChange('select')
  }, [document, handleToolChange, requestFocusedEditShape, selectedIds, setCropEditingImageId])

  const markBoardPersisted = useCallback((savedBoardId: string) => {
    setPersistedBoardIds((current) => (current[savedBoardId] ? current : { ...current, [savedBoardId]: true }))
  }, [setPersistedBoardIds])

  const handleSaveAuditBoardLoaded = useCallback((board: BoardPersistenceSummary) => {
    markBoardSavedAt(board.savedAt)
    markBoardPersisted(boardId)
    onBoardLoaded?.(board.title)
  }, [boardId, markBoardPersisted, markBoardSavedAt, onBoardLoaded])

  const handleSaveAuditBoardSaved = useCallback((board: BoardPersistenceSummary) => {
    markBoardSavedAt(board.savedAt)
    markBoardPersisted(boardId)
    onBoardSaved?.(board)
  }, [boardId, markBoardPersisted, markBoardSavedAt, onBoardSaved])

  return {
    canCropImage,
    canGroupSelection,
    canLockSelection,
    canUngroupSelection,
    canUnlockSelection,
    cropImage,
    handleSaveAuditBoardLoaded,
    handleSaveAuditBoardSaved,
    pointCount,
  }
}
