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
  | 'distribute-horizontal'
  | 'distribute-vertical'
  | 'duplicate'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'group'
  | 'layer-back'
  | 'layer-backward'
  | 'layer-forward'
  | 'layer-front'
  | 'lock'
  | 'paste'
  | 'select-all'
  | 'stretch-horizontal'
  | 'stretch-vertical'
  | 'tidy-column'
  | 'tidy-row'
  | 'ungroup'
  | 'unlock'

type KonvaContextMenuProps = {
  canDistribute: boolean
  canGroup: boolean
  canLock: boolean
  canPaste: boolean
  canTidy: boolean
  canUnlock: boolean
  canUngroup: boolean
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
  canDistribute,
  canGroup,
  canLock,
  canPaste,
  canTidy,
  canUnlock,
  canUngroup,
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
          <MenuButton disabled={!canGroup} label="Group" shortcut={`${shortcutMod}G`} onClick={() => onAction('group')} />
          <MenuButton disabled={!canUngroup} label="Ungroup" shortcut={`⇧${shortcutMod}G`} onClick={() => onAction('ungroup')} />
          <MenuButton disabled={!canLock} label="Lock" shortcut="⇧L" onClick={() => onAction('lock')} />
          <MenuButton disabled={!canUnlock} label="Unlock" shortcut="⇧L" onClick={() => onAction('unlock')} />
        </MenuSubmenu>
        <MenuSubmenu label="Arrange">
          <MenuSectionLabel label="Align" />
          <MenuButton disabled={!multipleSelection} label="Align left" onClick={() => onAction('align-left')} />
          <MenuButton disabled={!multipleSelection} label="Align center horizontally" onClick={() => onAction('align-center-x')} />
          <MenuButton disabled={!multipleSelection} label="Align right" onClick={() => onAction('align-right')} />
          <MenuButton disabled={!multipleSelection} label="Align top" onClick={() => onAction('align-top')} />
          <MenuButton disabled={!multipleSelection} label="Align center vertically" onClick={() => onAction('align-center-y')} />
          <MenuButton disabled={!multipleSelection} label="Align bottom" onClick={() => onAction('align-bottom')} />
          <MenuDivider />
          <MenuSectionLabel label="Distribute / Stretch" />
          <MenuButton disabled={!canDistribute} label="Distribute horizontally" onClick={() => onAction('distribute-horizontal')} />
          <MenuButton disabled={!canDistribute} label="Distribute vertically" onClick={() => onAction('distribute-vertical')} />
          <MenuButton disabled={!multipleSelection} label="Stretch horizontally" onClick={() => onAction('stretch-horizontal')} />
          <MenuButton disabled={!multipleSelection} label="Stretch vertically" onClick={() => onAction('stretch-vertical')} />
          <MenuDivider />
          <MenuSectionLabel label="Transform" />
          <MenuButton disabled={!hasSelection} label="Flip horizontal" onClick={() => onAction('flip-horizontal')} />
          <MenuButton disabled={!hasSelection} label="Flip vertical" onClick={() => onAction('flip-vertical')} />
          <MenuButton disabled label="Pack" />
          <MenuButton disabled={!canTidy} label="Arrange in row" onClick={() => onAction('tidy-row')} />
          <MenuButton disabled={!canTidy} label="Arrange in column" onClick={() => onAction('tidy-column')} />
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

function MenuSectionLabel({ label }: { label: string }) {
  return <div className="konva-context-menu__section-label">{label}</div>
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
