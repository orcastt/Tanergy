import { useReactFlow } from "@xyflow/react"

export default function CanvasControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()

  const zoom = Math.round(getZoom() * 100)

  return (
    <div style={{
      position: "absolute", bottom: "1rem", left: "4rem",
      background: "var(--bg-surface)", borderRadius: "0.5rem",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)",
      display: "flex", alignItems: "center", gap: "0.125rem",
      padding: "0.25rem", zIndex: 20,
    }}>
      <CtrlBtn icon="remove" onClick={() => zoomOut()} />
      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "2.5rem", textAlign: "center" }}>
        {zoom}%
      </span>
      <CtrlBtn icon="add" onClick={() => zoomIn()} />
      <div style={{ width: "1px", height: "20px", background: "var(--border-color)" }} />
      <CtrlBtn icon="fit_screen" onClick={() => fitView({ padding: 0.2 })} />
    </div>
  )
}

function CtrlBtn({ icon, onClick }: { icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "32px", height: "32px", borderRadius: "0.25rem",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", background: "transparent", cursor: "pointer",
        color: "var(--text-secondary)", transition: "background-color 150ms ease",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{icon}</span>
    </button>
  )
}
