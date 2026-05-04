import { useMemo, type ReactNode, type SyntheticEvent } from 'react'

export type KonvaContextMenuAction =
  | 'align-bottom'
  | 'align-center-x'
  | 'align-center-y'
  | 'align-left'
  | 'align-right'
  | 'align-top'
  | 'copy'
  | 'cut'
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
  containerHeight: number
  containerWidth: number
  hasSelection: boolean
  multipleSelection: boolean
  x: number
  y: number
  onAction: (action: KonvaContextMenuAction) => void
  onClose: () => void
}

const estimatedMenuHeight = 392
const menuWidth = 232
const viewportPadding = 8

export function KonvaContextMenu({
  canPaste,
  containerHeight,
  containerWidth,
  hasSelection,
  multipleSelection,
  onAction,
  onClose,
  x,
  y,
}: KonvaContextMenuProps) {
  const shortcutMod = useMemo(() => getShortcutModifier(), [])
  const left = clamp(x, viewportPadding, Math.max(viewportPadding, containerWidth - menuWidth - viewportPadding))
  const top = clamp(y, viewportPadding, Math.max(viewportPadding, containerHeight - estimatedMenuHeight - viewportPadding))
  const openSubmenusLeft = left > containerWidth - menuWidth * 2 - 24

  return (
    <>
      <button aria-label="Close context menu" className="konva-context-menu-backdrop" onClick={onClose} type="button" />
      <div
        className="konva-context-menu"
        data-submenus-left={openSubmenusLeft ? 'true' : undefined}
        onContextMenu={stopEvent}
        onPointerDown={stopEvent}
        style={{ left, top }}
      >
        <MenuButton disabled={!hasSelection} label="Cut" shortcut={`${shortcutMod}X`} onClick={() => onAction('cut')} />
        <MenuButton disabled={!hasSelection} label="Copy" shortcut={`${shortcutMod}C`} onClick={() => onAction('copy')} />
        <MenuButton disabled={!canPaste} label="Paste" shortcut={`${shortcutMod}V`} onClick={() => onAction('paste')} />
        <MenuButton disabled={!hasSelection} label="Duplicate" shortcut={`${shortcutMod}D`} onClick={() => onAction('duplicate')} />
        <MenuDivider />

        <MenuSubmenu label="Edit">
          <MenuButton disabled label="Group" shortcut={`${shortcutMod}G`} />
          <MenuButton disabled label="Ungroup" shortcut={`⇧${shortcutMod}G`} />
          <MenuButton disabled label="Lock" shortcut="⇧L" />
        </MenuSubmenu>
        <MenuSubmenu label="Arrange">
          <MenuSubmenu disabled={!multipleSelection} label="Align">
            <MenuButton disabled={!multipleSelection} label="Left" onClick={() => onAction('align-left')} />
            <MenuButton disabled={!multipleSelection} label="Center horizontally" onClick={() => onAction('align-center-x')} />
            <MenuButton disabled={!multipleSelection} label="Right" onClick={() => onAction('align-right')} />
            <MenuDivider />
            <MenuButton disabled={!multipleSelection} label="Top" onClick={() => onAction('align-top')} />
            <MenuButton disabled={!multipleSelection} label="Center vertically" onClick={() => onAction('align-center-y')} />
            <MenuButton disabled={!multipleSelection} label="Bottom" onClick={() => onAction('align-bottom')} />
          </MenuSubmenu>
          <MenuSubmenu disabled label="Distribute">
            <MenuButton disabled label="Horizontally" />
            <MenuButton disabled label="Vertically" />
          </MenuSubmenu>
          <MenuSubmenu disabled label="Stretch">
            <MenuButton disabled label="Horizontally" />
            <MenuButton disabled label="Vertically" />
          </MenuSubmenu>
          <MenuSubmenu disabled label="Flip">
            <MenuButton disabled label="Horizontal" />
            <MenuButton disabled label="Vertical" />
          </MenuSubmenu>
          <MenuButton disabled label="Pack" />
          <MenuButton disabled label="Arrange in row" />
          <MenuButton disabled label="Arrange in column" />
        </MenuSubmenu>
        <MenuSubmenu label="Reorder">
          <MenuButton disabled={!hasSelection} label="Bring to front" shortcut="]" onClick={() => onAction('layer-front')} />
          <MenuButton disabled={!hasSelection} label="Bring forward" shortcut="⌥]" onClick={() => onAction('layer-forward')} />
          <MenuButton disabled={!hasSelection} label="Send backward" shortcut="⌥[" onClick={() => onAction('layer-backward')} />
          <MenuButton disabled={!hasSelection} label="Send to back" shortcut="[" onClick={() => onAction('layer-back')} />
        </MenuSubmenu>
        <MenuButton disabled label="Move to page" />
        <MenuDivider />

        <MenuSubmenu disabled={!hasSelection} label="Copy as">
          <MenuButton disabled label="SVG" shortcut={`⇧${shortcutMod}C`} />
          <MenuButton disabled label="PNG" />
          <MenuButton disabled label="Transparent background" />
        </MenuSubmenu>
        <MenuSubmenu label="Export as">
          <MenuButton disabled label="SVG" />
          <MenuButton disabled label="PNG" />
          <MenuButton disabled label="Transparent background" />
        </MenuSubmenu>
        <MenuDivider />

        <MenuButton label="Select all" shortcut={`${shortcutMod}A`} onClick={() => onAction('select-all')} />
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
  onClick?: () => void
}) {
  return (
    <button data-danger={isDanger ? 'true' : undefined} disabled={disabled} onClick={onClick} type="button">
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  )
}

function MenuSubmenu({ children, disabled, label }: { children: ReactNode; disabled?: boolean; label: string }) {
  return (
    <div className="konva-context-menu__submenu" data-disabled={disabled ? 'true' : undefined}>
      <button aria-haspopup="menu" disabled={disabled} type="button">
        <span>{label}</span>
        <span aria-hidden className="konva-context-menu__submenu-arrow">›</span>
      </button>
      <div className="konva-context-menu__submenu-panel" role="menu">
        {children}
      </div>
    </div>
  )
}

function MenuDivider() {
  return <div className="konva-context-menu__divider" />
}

function getShortcutModifier() {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform) ? '⌘' : 'Ctrl+'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function stopEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}
