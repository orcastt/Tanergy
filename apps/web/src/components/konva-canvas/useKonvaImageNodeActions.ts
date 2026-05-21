import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument, CanvasImageShape, CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'
import {
  canCreateCanvasImageFromSelection,
  canCreateImageNodeFromSelection,
  createKonvaCanvasImageFromAssetRef,
  createKonvaCanvasImageFromImageNode,
  createKonvaImageNodesFromCanvasImages,
} from './konvaImageNodeConversion'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'

type KonvaHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaImageNodeActionsOptions = {
  activePageId?: string
  document: CanvasDocument
  history: KonvaHistory
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onPendingImagePasteComplete?: (pendingId: string) => void
  onPendingImagePasteStateChange?: (state: KonvaPendingImagePaste) => void
  onSelectionChange: (shapeIds: string[]) => void
  workspace?: TangentWorkspace
}

export function useKonvaImageNodeActions({
  activePageId,
  document,
  history,
  onDocumentChange,
  onPendingImagePasteComplete,
  onPendingImagePasteStateChange,
  onSelectionChange,
  selectedIds,
  workspace,
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
    void createKonvaCanvasImageFromImageNode(document, shapeId, workspace).then((result) => {
      if (!result) return
      history.checkpoint(document)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
    })
  }, [document, history, onDocumentChange, onSelectionChange, selectedIds, workspace])

  const sendGeneratedOutputToCanvas = useCallback((input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => {
    const sourceNode = document.shapes.find((shape): shape is CanvasNodeShape => (
      shape.id === input.shapeId &&
      shape.type === 'node_card'
    ))
    if (!sourceNode) return
    const placement = getGeneratedOutputCanvasPlacement(document, sourceNode)
    const result = createKonvaCanvasImageFromAssetRef(document, input.ref, placement, {
      sourceNodeId: sourceNode.id,
      title: input.ref.title,
    })
    if (!result) return
    const pendingId = `generated-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    pushGeneratedImagePlaceholder({
      activePageId,
      image: result.image,
      onPendingImagePasteComplete,
      onPendingImagePasteStateChange,
      pendingId,
    })
    history.checkpoint(document)
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
  }, [
    activePageId,
    document,
    history,
    onDocumentChange,
    onPendingImagePasteComplete,
    onPendingImagePasteStateChange,
    onSelectionChange,
  ])

  return {
    canConvertImageToNode: canCreateImageNodeFromSelection(document, selectedIds),
    canNodeToCanvas: canCreateCanvasImageFromSelection(document, selectedIds),
    convertImageToNode,
    sendGeneratedOutputToCanvas,
    sendImageNodeToCanvas,
  }
}

function getGeneratedOutputCanvasPlacement(document: CanvasDocument, sourceNode: CanvasNodeShape): CanvasPoint {
  const imagesFromSameNode = document.shapes.filter((shape): shape is CanvasImageShape => (
    shape.type === 'image' &&
    shape.props.sourceNodeId === sourceNode.id
  ))
  if (imagesFromSameNode.length === 0) {
    return {
      x: sourceNode.x + sourceNode.props.width + 48,
      y: sourceNode.y,
    }
  }
  const rightmostEdge = Math.max(...imagesFromSameNode.map((shape) => shape.x + shape.props.width))
  const topmostY = Math.min(...imagesFromSameNode.map((shape) => shape.y))
  return {
    x: rightmostEdge + 24,
    y: topmostY,
  }
}

function pushGeneratedImagePlaceholder(input: {
  activePageId?: string
  image: CanvasImageShape
  onPendingImagePasteComplete?: (pendingId: string) => void
  onPendingImagePasteStateChange?: (state: KonvaPendingImagePaste) => void
  pendingId: string
}) {
  if (!input.activePageId || !input.onPendingImagePasteStateChange) return
  const center = {
    x: input.image.x + input.image.props.width / 2,
    y: input.image.y + input.image.props.height / 2,
  }
  const baseState = {
    center,
    height: input.image.props.height,
    id: input.pendingId,
    pageId: input.activePageId,
    status: 'pending' as const,
    width: input.image.props.width,
  }
  input.onPendingImagePasteStateChange({
    ...baseState,
    detail: 'Sending to canvas...',
    progress: 0.24,
  })
  window.setTimeout(() => {
    input.onPendingImagePasteStateChange?.({
      ...baseState,
      detail: 'Placing image...',
      progress: 0.76,
    })
  }, 100)
  window.setTimeout(() => {
    input.onPendingImagePasteComplete?.(input.pendingId)
  }, 260)
}
