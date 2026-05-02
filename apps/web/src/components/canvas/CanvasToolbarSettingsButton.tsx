'use client'

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
      disabled={disabled}
      onClick={onOpen}
      title="Canvas settings"
      type="button"
    >
      <span aria-hidden>⚙</span>
    </button>
  )
}
