import { useCanvasStore } from "../../store/canvasStore"
import { runAll } from "../../lib/executionEngine"

interface Props {
  nodeId: string
  status: "idle" | "running" | "waiting" | "done" | "error"
}

export default function NodeRunButton({ nodeId, status }: Props) {
  const setNodeStatus = useCanvasStore((s) => s.setNodeStatus)
  const setNodeResult = useCanvasStore((s) => s.setNodeResult)

  if (status === "running") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setNodeStatus(nodeId, "idle")
        }}
        style={{
          padding: "0.25rem 0.625rem",
          borderRadius: "9999px",
          border: "none",
          fontSize: "0.6875rem",
          fontWeight: 600,
          background: "#EF4444",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        Stop
      </button>
    )
  }

  if (status === "done" || status === "error") {
    return (
      <div style={{ display: "flex", gap: "0.25rem" }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setNodeStatus(nodeId, "idle")
            setNodeResult(nodeId, null)
          }}
          title="Clear result"
          style={{
            width: "24px", height: "24px", borderRadius: "0.375rem",
            border: "none", background: "var(--bg-hover)",
            color: "var(--text-secondary)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>refresh</span>
        </button>
      </div>
    )
  }

  if (status === "waiting") {
    return null
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        runAll()
      }}
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        border: "none",
        fontSize: "0.6875rem",
        fontWeight: 600,
        background: "#242424",
        color: "#ffffff",
        cursor: "pointer",
      }}
    >
      Run
    </button>
  )
}
