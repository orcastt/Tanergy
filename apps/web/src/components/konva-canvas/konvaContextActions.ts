import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import { alignKonvaShapes, type KonvaAlignAction } from './konvaArrangeCommands'
import { deleteKonvaShapes, duplicateKonvaShapes, reorderKonvaShapes } from './konvaCanvasStyle'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import { copyKonvaShapes, pasteKonvaShapes } from './konvaShapeCommands'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type RunKonvaContextActionOptions = {
  action: KonvaContextMenuAction
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  history: KonvaCanvasHistory
  pastePoint?: { x: number; y: number }
  selectedIds: string[]
  onClipboardChange: (shapeCount: number) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function runKonvaContextAction(options: RunKonvaContextActionOptions) {
  const { action, clipboardRef, document, history, onClipboardChange, onDocumentChange, onSelectionChange, pastePoint, selectedIds } = options

  if (action === 'select-all') {
    onSelectionChange(document.shapes.map((shape) => shape.id))
    return
  }
  if (action === 'copy') {
    clipboardRef.current = copyKonvaShapes(document, selectedIds)
    onClipboardChange(clipboardRef.current.length)
    return
  }
  if (action === 'paste') {
    history.checkpoint(document)
    const result = pasteKonvaShapes(document, clipboardRef.current, pastePoint)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }
  if (selectedIds.length === 0) return

  history.checkpoint(document)
  if (action === 'cut') {
    clipboardRef.current = copyKonvaShapes(document, selectedIds)
    onClipboardChange(clipboardRef.current.length)
    const result = deleteKonvaShapes(document, selectedIds)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }
  if (action === 'delete') {
    const result = deleteKonvaShapes(document, selectedIds)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }
  if (action === 'duplicate') {
    const result = duplicateKonvaShapes(document, selectedIds)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }

  const layerAction = getContextLayerAction(action)
  if (layerAction) {
    onDocumentChange(reorderKonvaShapes(document, selectedIds, layerAction))
    return
  }

  const alignAction = getContextAlignAction(action)
  if (alignAction) onDocumentChange(alignKonvaShapes(document, selectedIds, alignAction))
}

function getContextLayerAction(action: KonvaContextMenuAction): Parameters<typeof reorderKonvaShapes>[2] | null {
  if (action === 'layer-back') return 'back'
  if (action === 'layer-backward') return 'backward'
  if (action === 'layer-forward') return 'forward'
  if (action === 'layer-front') return 'front'
  return null
}

function getContextAlignAction(action: KonvaContextMenuAction): KonvaAlignAction | null {
  if (action === 'align-bottom') return 'bottom'
  if (action === 'align-center-x') return 'center-x'
  if (action === 'align-center-y') return 'center-y'
  if (action === 'align-left') return 'left'
  if (action === 'align-right') return 'right'
  if (action === 'align-top') return 'top'
  return null
}
