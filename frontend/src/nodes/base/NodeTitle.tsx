import type { ReactNode } from "react"

type Status = "idle" | "running" | "waiting" | "done" | "error"

interface Props {
  icon?: ReactNode
  title: string
  status?: Status
  footer?: ReactNode
}

export default function NodeTitle({ icon, title, status, footer }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.75rem", borderBottom: "1px solid #efeded",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flex: 1 }}>
        {icon}
        <span style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "0.875rem", fontWeight: 600, color: "#0e0f0f",
        }}>
          {title}
        </span>
      </div>
      {footer}
      {status === "running" && (
        <div style={{
          width: "14px", height: "14px", border: "2px solid #3B82F6",
          borderTopColor: "transparent", borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
      )}
      {status === "waiting" && (
        <div style={{
          width: "14px", height: "14px", border: "2px solid #F59E0B",
          borderTopColor: "transparent", borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
      )}
      {status === "done" && (
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#22C55E" }}>check_circle</span>
      )}
      {status === "error" && (
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#EF4444" }}>error</span>
      )}
    </div>
  )
}
