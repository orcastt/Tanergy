'use client'

import { CanvasLineIcon } from './CanvasLineIcon'

type CanvasToolbarSettingsButtonProps = {
  disabled: boolean
  isOpen: boolean
  onOpen: () => void
}

export function CanvasToolbarSettingsButton({ disabled, isOpen, onOpen }: CanvasToolbarSettingsButtonProps) {
  return (
    <button
      aria-label="Canvas settings"
      className={isOpen ? 'is-active' : undefined}
      data-tooltip="Canvas settings"
      disabled={disabled}
      onClick={onOpen}
      type="button"
    >
      <CanvasLineIcon name="settings" />
    </button>
  )
}
