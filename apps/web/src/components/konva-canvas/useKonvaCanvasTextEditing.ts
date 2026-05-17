'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { updateTextShape } from './konvaShapeCommands'
import { canReplaceImageNode } from './useKonvaImageNodeUpload'
import { getEditableKonvaNodeTextField, type KonvaNodeTextFieldName } from './KonvaNodeTextEditor'
import { isKonvaEditableTextShape, type KonvaEditableTextShape } from './KonvaTextEditor'

type UseKonvaCanvasTextEditingOptions = {
  document: CanvasDocument
  editingNodeText: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingTextId: string | null
  history: {
    checkpoint: (document?: CanvasDocument) => void
  }
  promptImageNodeUpload: (shapeId: string) => void
  requestFocusedEditShape: (shapeId: string, targetLabel: string) => boolean
  sendChatMessage: (shapeId: string, value: string) => void
  setDocument: Dispatch<SetStateAction<CanvasDocument>>
  setEditingNodeText: Dispatch<SetStateAction<{ fieldName: KonvaNodeTextFieldName; shapeId: string } | null>>
  setEditingTextId: Dispatch<SetStateAction<string | null>>
  setNodeTextField: (shapeId: string, fieldName: KonvaNodeTextFieldName, value: string) => void
}

export function useKonvaCanvasTextEditing({
  document,
  editingNodeText,
  editingTextId,
  history,
  promptImageNodeUpload,
  requestFocusedEditShape,
  sendChatMessage,
  setDocument,
  setEditingNodeText,
  setEditingTextId,
  setNodeTextField,
}: UseKonvaCanvasTextEditingOptions) {
  const editingTextShape = document.shapes.find((shape): shape is KonvaEditableTextShape => (
    shape.id === editingTextId && isKonvaEditableTextShape(shape)
  )) ?? null

  const editingNodeTextShape = editingNodeText
    ? document.shapes.find((shape): shape is CanvasNodeShape => shape.id === editingNodeText.shapeId && shape.type === 'node_card') ?? null
    : null

  const handleStageNodeTextEditStart = useCallback((shapeId: string, fieldName: KonvaNodeTextFieldName) => {
    if (!requestFocusedEditShape(shapeId, 'card')) return
    const shape = document.shapes.find((item) => item.id === shapeId)
    if (!shape || shape.type !== 'node_card' || shape.isLocked) return
    setEditingNodeText({ fieldName, shapeId })
  }, [document.shapes, requestFocusedEditShape, setEditingNodeText])

  const handleStageTextEditStart = useCallback((shapeId: string) => {
    const shape = document.shapes.find((item) => item.id === shapeId)
    if (shape?.isLocked) return
    if (shape?.type === 'node_card' && shape.props.nodeType === 'image') {
      if (!requestFocusedEditShape(shapeId, 'image node')) return
      if (!canReplaceImageNode(document, shapeId)) return
      promptImageNodeUpload(shapeId)
      return
    }
    if (shape?.type === 'node_card') {
      const fieldName = getEditableKonvaNodeTextField(shape)
      if (fieldName) {
        if (!requestFocusedEditShape(shapeId, 'card')) return
        setEditingNodeText({ fieldName, shapeId })
        return
      }
    }
    if (shape && isKonvaEditableTextShape(shape)) {
      if (!requestFocusedEditShape(shapeId, 'text')) return
      setEditingTextId(shapeId)
    }
  }, [document, promptImageNodeUpload, requestFocusedEditShape, setEditingNodeText, setEditingTextId])

  const handleEditingTextCommit = useCallback((text: string) => {
    if (!editingTextShape) return
    history.checkpoint(document)
    setDocument((current) => updateTextShape(current, editingTextShape.id, text))
    setEditingTextId(null)
  }, [document, editingTextShape, history, setDocument, setEditingTextId])

  const handleEditingNodeTextCommit = useCallback((value: string) => {
    if (!editingNodeText || !editingNodeTextShape) return
    setNodeTextField(editingNodeTextShape.id, editingNodeText.fieldName, value)
    setEditingNodeText(null)
  }, [editingNodeText, editingNodeTextShape, setEditingNodeText, setNodeTextField])

  const handleEditingNodeTextSubmit = editingNodeText?.fieldName === 'chatDraft' && editingNodeTextShape
    ? (value: string) => {
        sendChatMessage(editingNodeTextShape.id, value)
        setEditingNodeText(null)
      }
    : undefined

  return {
    editingNodeText,
    editingNodeTextShape,
    editingTextId,
    editingTextShape,
    handleEditingNodeTextCommit,
    handleEditingNodeTextSubmit,
    handleEditingTextCommit,
    handleStageNodeTextEditStart,
    handleStageTextEditStart,
  }
}
