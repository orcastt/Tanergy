import { useEffect, useRef } from "react"

interface MenuItem {
  label: string
  shortcut?: string
  action: () => void
  disabled?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 10000,
        background: "var(--bg-surface)",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
        padding: "0.25rem 0",
        minWidth: "160px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            if (!item.disabled) { item.action(); onClose() }
          }}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.8125rem",
            color: item.disabled ? "var(--text-placeholder)" : "var(--text-primary)",
            cursor: item.disabled ? "default" : "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1.5rem",
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "transparent"
          }}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>{item.shortcut}</span>
          )}
        </div>
      ))}
    </div>
  )
}
