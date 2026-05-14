import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import {
  alignKonvaShapes,
  distributeKonvaShapes,
  flipKonvaShapes,
  stretchKonvaShapes,
  tidyKonvaShapes,
  type KonvaAlignAction,
  type KonvaDistributeAction,
  type KonvaFlipAction,
  type KonvaStretchAction,
  type KonvaTidyAction,
} from './konvaArrangeCommands'
import { deleteKonvaShapes, duplicateKonvaShapes, reorderKonvaShapes } from './konvaCanvasStyle'
import { pasteKonvaClipboard, writeKonvaShapesToSystemClipboard } from './konvaClipboardCommands'
import type { KonvaContextMenuAction } from './KonvaContextMenu'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'
import { groupKonvaShapes, setKonvaShapesLocked, ungroupKonvaShapes } from './konvaGroupCommands'
import { copyKonvaShapes } from './konvaShapeCommands'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type RunKonvaContextActionOptions = {
  action: KonvaContextMenuAction
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  getActivePageId?: () => string
  history: KonvaCanvasHistory
  onImagePasteComplete?: (pendingId: string) => void
  onImagePasteStateChange?: (state: KonvaPendingImagePaste) => void
  onPageDocumentChange?: (pageId: string, updater: (document: CanvasDocument) => CanvasDocument) => boolean
  pageId: string
  pastePoint?: { x: number; y: number }
  selectedIds: string[]
  onClipboardChange: (shapeCount: number) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
  workspace?: TangentWorkspace
}

export async function runKonvaContextAction(options: RunKonvaContextActionOptions) {
  const { action, clipboardRef, document, history, onClipboardChange, onDocumentChange, onSelectionChange, pastePoint, selectedIds } = options

  if (action === 'select-all') {
    onSelectionChange(document.shapes.map((shape) => shape.id))
    return
  }
  if (action === 'copy') {
    clipboardRef.current = copyKonvaShapes(document, selectedIds)
    onClipboardChange(clipboardRef.current.length)
    void writeKonvaShapesToSystemClipboard(clipboardRef.current)
    return
  }
  if (action === 'paste') {
    await pasteKonvaClipboard({
      getActivePageId: options.getActivePageId,
      clipboardRef,
      document,
      history,
      onClipboardChange,
      onDocumentChange,
      onImagePasteComplete: options.onImagePasteComplete,
      onImagePasteStateChange: options.onImagePasteStateChange,
      onPageDocumentChange: options.onPageDocumentChange,
      onSelectionChange,
      pageId: options.pageId,
      point: pastePoint ?? { x: 0, y: 0 },
      selectedIds,
      workspace: options.workspace,
    })
    return
  }
  if (selectedIds.length === 0) return

  history.checkpoint(document)
  if (action === 'cut') {
    clipboardRef.current = copyKonvaShapes(document, selectedIds)
    onClipboardChange(clipboardRef.current.length)
    void writeKonvaShapesToSystemClipboard(clipboardRef.current)
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
  if (action === 'group') {
    const result = groupKonvaShapes(document, selectedIds)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }
  if (action === 'ungroup') {
    const result = ungroupKonvaShapes(document, selectedIds)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
    return
  }
  if (action === 'lock' || action === 'unlock') {
    const result = setKonvaShapesLocked(document, selectedIds, action === 'lock')
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
  if (alignAction) {
    onDocumentChange(alignKonvaShapes(document, selectedIds, alignAction))
    return
  }

  const distributeAction = getContextDistributeAction(action)
  if (distributeAction) {
    onDocumentChange(distributeKonvaShapes(document, selectedIds, distributeAction))
    return
  }

  const stretchAction = getContextStretchAction(action)
  if (stretchAction) {
    onDocumentChange(stretchKonvaShapes(document, selectedIds, stretchAction))
    return
  }

  const flipAction = getContextFlipAction(action)
  if (flipAction) {
    onDocumentChange(flipKonvaShapes(document, selectedIds, flipAction))
    return
  }

  const tidyAction = getContextTidyAction(action)
  if (tidyAction) onDocumentChange(tidyKonvaShapes(document, selectedIds, tidyAction))
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

function getContextDistributeAction(action: KonvaContextMenuAction): KonvaDistributeAction | null {
  if (action === 'distribute-horizontal') return 'horizontal'
  if (action === 'distribute-vertical') return 'vertical'
  return null
}

function getContextStretchAction(action: KonvaContextMenuAction): KonvaStretchAction | null {
  if (action === 'stretch-horizontal') return 'horizontal'
  if (action === 'stretch-vertical') return 'vertical'
  return null
}

function getContextFlipAction(action: KonvaContextMenuAction): KonvaFlipAction | null {
  if (action === 'flip-horizontal') return 'horizontal'
  if (action === 'flip-vertical') return 'vertical'
  return null
}

function getContextTidyAction(action: KonvaContextMenuAction): KonvaTidyAction | null {
  if (action === 'tidy-column') return 'column'
  if (action === 'tidy-row') return 'row'
  return null
}
