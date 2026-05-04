import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import {
  canCreateCanvasImageFromSelection,
  canCreateImageNodeFromSelection,
  createKonvaCanvasImageFromImageNode,
  createKonvaImageNodesFromCanvasImages,
} from './konvaImageNodeConversion'

type KonvaHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaImageNodeActionsOptions = {
  document: CanvasDocument
  history: KonvaHistory
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaImageNodeActions({
  document,
  history,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaImageNodeActionsOptions) {
  const convertImageToNode = useCallback(() => {
    const result = createKonvaImageNodesFromCanvasImages(document, selectedIds)
    if (!result) return
    history.checkpoint(document)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
  }, [document, history, onDocumentChange, onSelectionChange, selectedIds])

  const sendImageNodeToCanvas = useCallback((shapeIdOverride?: string) => {
    const shapeId = shapeIdOverride ?? selectedIds[0]
    if (!shapeId) return
    void createKonvaCanvasImageFromImageNode(document, shapeId).then((result) => {
      if (!result) return
      history.checkpoint(document)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
    })
  }, [document, history, onDocumentChange, onSelectionChange, selectedIds])

  return {
    canConvertImageToNode: canCreateImageNodeFromSelection(document, selectedIds),
    canNodeToCanvas: canCreateCanvasImageFromSelection(document, selectedIds),
    convertImageToNode,
    sendImageNodeToCanvas,
  }
}
