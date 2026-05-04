import type { Dispatch, SetStateAction } from 'react'
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
import { canKonvaSelectionFlip } from './konvaShapeCapabilities'
import { IconButton, IconGrid, PropertyBlock } from './KonvaPropertiesPrimitives'

type KonvaPropertiesSelectionActionsProps = {
  document: CanvasDocument
  selectedIds: string[]
  selectedShapes: CanvasShape[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

type SelectionAction =
  | { action: 'delete' | 'duplicate'; icon: string; label: string }
  | { action: 'layer-back' | 'layer-backward' | 'layer-forward' | 'layer-front'; icon: string; label: string }
  | { action: 'align'; align: KonvaAlignAction; icon: string; label: string; minSelected: number }
  | { action: 'distribute'; distribute: KonvaDistributeAction; icon: string; label: string; minSelected: number }
  | { action: 'flip'; flip: KonvaFlipAction; icon: string; label: string; minSelected: number }
  | { action: 'stretch'; stretch: KonvaStretchAction; icon: string; label: string; minSelected: number }
  | { action: 'tidy'; icon: string; label: string; minSelected: number; tidy: KonvaTidyAction }

const alignActions: SelectionAction[] = [
  { action: 'align', align: 'left', icon: 'style-action-icon style-action-icon--align-left', label: 'Align left', minSelected: 2 },
  { action: 'align', align: 'center-x', icon: 'style-action-icon style-action-icon--align-center-x', label: 'Align center', minSelected: 2 },
  { action: 'align', align: 'right', icon: 'style-action-icon style-action-icon--align-right', label: 'Align right', minSelected: 2 },
  { action: 'align', align: 'top', icon: 'style-action-icon style-action-icon--align-top', label: 'Align top', minSelected: 2 },
  { action: 'align', align: 'center-y', icon: 'style-action-icon style-action-icon--align-center-y', label: 'Align middle', minSelected: 2 },
  { action: 'align', align: 'bottom', icon: 'style-action-icon style-action-icon--align-bottom', label: 'Align bottom', minSelected: 2 },
]

const layerActions: SelectionAction[] = [
  { action: 'layer-back', icon: 'style-action-icon style-action-icon--layer-back', label: 'Send to back' },
  { action: 'layer-backward', icon: 'style-action-icon style-action-icon--layer-down', label: 'Send backward' },
  { action: 'layer-forward', icon: 'style-action-icon style-action-icon--layer-up', label: 'Bring forward' },
  { action: 'layer-front', icon: 'style-action-icon style-action-icon--layer-front', label: 'Bring to front' },
]

const operationActions: SelectionAction[] = [
  { action: 'duplicate', icon: 'style-action-icon style-action-icon--duplicate', label: 'Duplicate' },
  { action: 'delete', icon: 'style-action-icon style-action-icon--delete', label: 'Delete' },
  { action: 'stretch', icon: 'style-action-icon style-action-icon--stretch-x', label: 'Stretch horizontally', minSelected: 2, stretch: 'horizontal' },
  { action: 'stretch', icon: 'style-action-icon style-action-icon--stretch-y', label: 'Stretch vertically', minSelected: 2, stretch: 'vertical' },
  { action: 'distribute', distribute: 'horizontal', icon: 'style-action-icon style-action-icon--distribute-x', label: 'Distribute horizontally', minSelected: 3 },
  { action: 'distribute', distribute: 'vertical', icon: 'style-action-icon style-action-icon--distribute-y', label: 'Distribute vertically', minSelected: 3 },
  { action: 'flip', flip: 'horizontal', icon: 'style-action-icon style-action-icon--flip-x', label: 'Flip horizontal', minSelected: 1 },
  { action: 'flip', flip: 'vertical', icon: 'style-action-icon style-action-icon--flip-y', label: 'Flip vertical', minSelected: 1 },
  { action: 'tidy', icon: 'style-action-icon style-action-icon--tidy-row', label: 'Arrange in row', minSelected: 2, tidy: 'row' },
  { action: 'tidy', icon: 'style-action-icon style-action-icon--tidy-column', label: 'Arrange in column', minSelected: 2, tidy: 'column' },
]

export function KonvaPropertiesSelectionActions({
  document,
  onDocumentChange,
  onHistoryCheckpoint,
  onSelectionChange,
  selectedIds,
  selectedShapes,
}: KonvaPropertiesSelectionActionsProps) {
  const selectedCount = selectedShapes.length
  if (selectedCount === 0) return null
  const actions = !canKonvaSelectionFlip(selectedShapes)
    ? operationActions.filter((action) => action.action !== 'flip')
    : operationActions

  const runAction = (action: SelectionAction) => {
    if (!canRunAction(action, selectedCount)) return
    onHistoryCheckpoint(document)

    if (action.action === 'duplicate') {
      const result = duplicateKonvaShapes(document, selectedIds)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
      return
    }
    if (action.action === 'delete') {
      const result = deleteKonvaShapes(document, selectedIds)
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
      return
    }
    if (isLayerSelectionAction(action)) {
      onDocumentChange((current) => reorderKonvaShapes(current, selectedIds, getLayerAction(action.action)))
      return
    }
    if (action.action === 'align') onDocumentChange((current) => alignKonvaShapes(current, selectedIds, action.align))
    if (action.action === 'distribute') onDocumentChange((current) => distributeKonvaShapes(current, selectedIds, action.distribute))
    if (action.action === 'flip') onDocumentChange((current) => flipKonvaShapes(current, selectedIds, action.flip))
    if (action.action === 'stretch') onDocumentChange((current) => stretchKonvaShapes(current, selectedIds, action.stretch))
    if (action.action === 'tidy') onDocumentChange((current) => tidyKonvaShapes(current, selectedIds, action.tidy))
  }

  return (
    <>
      <PropertyBlock label="Align">
        <IconGrid>{alignActions.map((action) => renderActionButton(action, selectedCount, runAction))}</IconGrid>
      </PropertyBlock>
      <PropertyBlock label="Layer">
        <IconGrid>{layerActions.map((action) => renderActionButton(action, selectedCount, runAction))}</IconGrid>
      </PropertyBlock>
      <PropertyBlock label="Actions">
        <IconGrid>{actions.map((action) => renderActionButton(action, selectedCount, runAction))}</IconGrid>
      </PropertyBlock>
    </>
  )
}

function renderActionButton(action: SelectionAction, selectedCount: number, runAction: (action: SelectionAction) => void) {
  const disabledReason = getDisabledReason(action, selectedCount)
  return (
    <IconButton
      disabled={Boolean(disabledReason)}
      icon={action.icon}
      key={`${action.action}-${action.label}`}
      label={action.label}
      onClick={() => runAction(action)}
      tooltip={disabledReason ?? action.label}
    />
  )
}

function canRunAction(action: SelectionAction, selectedCount: number) {
  return selectedCount >= ('minSelected' in action ? action.minSelected : 1)
}

function getDisabledReason(action: SelectionAction, selectedCount: number) {
  const minSelected = 'minSelected' in action ? action.minSelected : 1
  if (selectedCount >= minSelected) return null
  return minSelected === 1 ? 'Select a shape first' : `Select ${minSelected} or more shapes`
}

function isLayerSelectionAction(action: SelectionAction): action is Extract<SelectionAction, { action: 'layer-back' | 'layer-backward' | 'layer-forward' | 'layer-front' }> {
  return action.action === 'layer-back'
    || action.action === 'layer-backward'
    || action.action === 'layer-forward'
    || action.action === 'layer-front'
}

function getLayerAction(action: Extract<SelectionAction, { action: 'layer-back' | 'layer-backward' | 'layer-forward' | 'layer-front' }>['action']) {
  if (action === 'layer-back') return 'back'
  if (action === 'layer-backward') return 'backward'
  if (action === 'layer-forward') return 'forward'
  return 'front'
}
