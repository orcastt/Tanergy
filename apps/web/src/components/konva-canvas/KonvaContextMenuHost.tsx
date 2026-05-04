import type { CanvasDocument } from '@/features/canvas-engine'
import { KonvaContextMenu, type KonvaContextMenuAction } from './KonvaContextMenu'
import { hasKonvaGroupedSelection } from './konvaGroupCommands'
import { canKonvaSelectionFlip } from './konvaShapeCapabilities'

type KonvaContextMenuHostProps = {
  canLockSelection: boolean
  canUnlockSelection: boolean
  contextMenu: { x: number; y: number } | null
  document: CanvasDocument
  height: number
  selectedIds: string[]
  width: number
  onAction: (action: KonvaContextMenuAction) => void
  onClose: () => void
}

export function KonvaContextMenuHost({
  canLockSelection,
  canUnlockSelection,
  contextMenu,
  document,
  height,
  onAction,
  onClose,
  selectedIds,
  width,
}: KonvaContextMenuHostProps) {
  if (!contextMenu) return null
  const selectedShapes = document.shapes.filter((shape) => selectedIds.includes(shape.id))
  return (
    <KonvaContextMenu
      canDistribute={selectedIds.length > 2}
      canFlip={canKonvaSelectionFlip(selectedShapes)}
      canGroup={selectedIds.length > 1}
      canLock={canLockSelection}
      canPaste
      canTidy={selectedIds.length > 1}
      canUnlock={canUnlockSelection}
      canUngroup={hasKonvaGroupedSelection(document.shapes, selectedIds)}
      containerHeight={height}
      containerWidth={width}
      hasSelection={selectedIds.length > 0}
      multipleSelection={selectedIds.length > 1}
      onAction={onAction}
      onClose={onClose}
      x={contextMenu.x}
      y={contextMenu.y}
    />
  )
}
