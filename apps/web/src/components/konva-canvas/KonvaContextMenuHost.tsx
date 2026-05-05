import type { CanvasDocument } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import { KonvaContextMenu, type KonvaContextMenuAction } from './KonvaContextMenu'
import { hasKonvaGroupedSelection } from './konvaGroupCommands'
import { canKonvaSelectionFlip } from './konvaShapeCapabilities'

type KonvaContextMenuHostProps = {
  activePageId: string
  canLockSelection: boolean
  canUnlockSelection: boolean
  contextMenu: { x: number; y: number } | null
  document: CanvasDocument
  height: number
  pages: SerializedKonvaBoardPage[]
  selectedIds: string[]
  width: number
  onAction: (action: KonvaContextMenuAction) => void
  onClose: () => void
}

export function KonvaContextMenuHost({
  activePageId,
  canLockSelection,
  canUnlockSelection,
  contextMenu,
  document,
  height,
  onAction,
  onClose,
  pages,
  selectedIds,
  width,
}: KonvaContextMenuHostProps) {
  if (!contextMenu) return null
  const selectedShapes = document.shapes.filter((shape) => selectedIds.includes(shape.id))
  const moveToPages = pages
    .filter((page) => page.id !== activePageId)
    .map((page) => ({ id: page.id, title: page.title }))
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
      moveToPages={moveToPages}
      onAction={onAction}
      onClose={onClose}
      x={contextMenu.x}
      y={contextMenu.y}
    />
  )
}
