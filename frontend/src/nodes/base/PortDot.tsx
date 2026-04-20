import type { PortType } from "../../types/node"
import { PORT_COLORS } from "../../types/node"

interface Props {
  type: PortType
  label?: string
  side: "left" | "right"
}

export default function PortDot({ type, label, side }: Props) {
  const color = PORT_COLORS[type]

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      flexDirection: side === "left" ? "row" : "row-reverse",
    }}>
      <div style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        transition: "transform 150ms ease",
        cursor: "crosshair",
        flexShrink: 0,
      }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.4)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      />
      {label && (
        <span style={{ fontSize: "10px", color: "#747878", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
    </div>
  )
}
