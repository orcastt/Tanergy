import { useCanvasStore } from "../../store/canvasStore"
import { runAll } from "../../lib/executionEngine"

interface Props {
  nodeId: string
  status: "idle" | "running" | "waiting" | "done" | "error"
}

export default function NodeRunButton({ nodeId, status }: Props) {
  const setNodeStatus = useCanvasStore((s) => s.setNodeStatus)

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

  if (status === "waiting" || status === "done") {
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