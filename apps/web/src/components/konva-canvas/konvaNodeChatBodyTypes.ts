import type { Dispatch, SetStateAction } from 'react'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'

export type KonvaNodeChatBodyProps = {
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  shape: CanvasNodeShape
  onChatModelChange?: (shapeId: string, modelId: string) => void
  onChatRegenerate?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onFocusedEditRequest?: (shapeId: string, source: 'chat-model-menu' | 'field-dropdown') => boolean
  onFocusedEditStateChange?: (
    shapeId: string,
    source: 'chat-model-menu' | 'field-dropdown',
    active: boolean,
  ) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  zoom: number
}

export type ChatTooltipState = null | {
  anchorX: number
  anchorY: number
  id: string
  label: string
}

export type SetChatTooltipState = Dispatch<SetStateAction<ChatTooltipState>>
