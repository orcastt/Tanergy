import type { CSSProperties, ReactNode } from 'react'

type IconButtonProps = {
  active?: boolean
  disabled?: boolean
  icon: string
  iconData?: string
  label: string
  tooltip?: string
  onClick?: () => void
}

const iconButtonWrapStyle: CSSProperties = {
  display: 'grid',
  minWidth: 0,
}

const iconButtonStyle: CSSProperties = {
  width: '100%',
}

const disabledIconButtonStyle: CSSProperties = {
  ...iconButtonStyle,
  cursor: 'not-allowed',
  opacity: 0.42,
}

export function PropertyBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="konva-canvas-properties__block">
      <p>{label}</p>
      {children}
    </section>
  )
}

export function SegmentedButtons({ children }: { children: ReactNode }) {
  return <div className="konva-canvas-properties__segmented">{children}</div>
}

export function IconGrid({ children }: { children: ReactNode }) {
  return <div className="konva-canvas-properties__icon-grid">{children}</div>
}

export function IconButton({
  active,
  disabled,
  icon,
  iconData,
  label,
  onClick,
  tooltip = label,
}: IconButtonProps) {
  return (
    <span data-tooltip={tooltip} style={iconButtonWrapStyle} title={tooltip}>
      <button
        aria-label={label}
        className={active ? 'is-active' : undefined}
        data-tooltip={tooltip}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        style={disabled ? disabledIconButtonStyle : iconButtonStyle}
        type="button"
      >
        <span aria-hidden className={icon} data-style-icon={iconData} />
      </button>
    </span>
  )
}
