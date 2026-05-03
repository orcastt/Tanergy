import type { SyntheticEvent } from 'react'

export type KonvaContextMenuAction =
  | 'copy'
  | 'delete'
  | 'duplicate'
  | 'layer-back'
  | 'layer-backward'
  | 'layer-forward'
  | 'layer-front'
  | 'paste'
  | 'select-all'

type KonvaContextMenuProps = {
  canPaste: boolean
  hasSelection: boolean
  x: number
  y: number
  onAction: (action: KonvaContextMenuAction) => void
  onClose: () => void
}

export function KonvaContextMenu({
  canPaste,
  hasSelection,
  onAction,
  onClose,
  x,
  y,
}: KonvaContextMenuProps) {
  return (
    <>
      <button aria-label="Close context menu" className="konva-context-menu-backdrop" onClick={onClose} type="button" />
      <div
        className="konva-context-menu"
        onContextMenu={stopEvent}
        onPointerDown={stopEvent}
        style={{ left: x, top: y }}
      >
        <MenuButton disabled={!hasSelection} label="Copy" shortcut="⌘C" onClick={() => onAction('copy')} />
        <MenuButton disabled={!canPaste} label="Paste" shortcut="⌘V" onClick={() => onAction('paste')} />
        <MenuButton disabled={!hasSelection} label="Duplicate" shortcut="⌘D" onClick={() => onAction('duplicate')} />
        <MenuDivider />
        <MenuButton disabled={!hasSelection} label="Bring to front" shortcut="]" onClick={() => onAction('layer-front')} />
        <MenuButton disabled={!hasSelection} label="Bring forward" shortcut="⌥]" onClick={() => onAction('layer-forward')} />
        <MenuButton disabled={!hasSelection} label="Send backward" shortcut="⌥[" onClick={() => onAction('layer-backward')} />
        <MenuButton disabled={!hasSelection} label="Send to back" shortcut="[" onClick={() => onAction('layer-back')} />
        <MenuDivider />
        <MenuButton label="Select all" shortcut="⌘A" onClick={() => onAction('select-all')} />
        <MenuButton disabled={!hasSelection} isDanger label="Delete" shortcut="⌫" onClick={() => onAction('delete')} />
      </div>
    </>
  )
}

function MenuButton({
  disabled,
  isDanger,
  label,
  onClick,
  shortcut,
}: {
  disabled?: boolean
  isDanger?: boolean
  label: string
  shortcut?: string
  onClick: () => void
}) {
  return (
    <button data-danger={isDanger ? 'true' : undefined} disabled={disabled} onClick={onClick} type="button">
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  )
}

function MenuDivider() {
  return <div className="konva-context-menu__divider" />
}

function stopEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}
