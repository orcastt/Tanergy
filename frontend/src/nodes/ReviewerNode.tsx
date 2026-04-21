import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

export default function ReviewerNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>rate_review</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      {status === "running" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{
            padding: "0.5rem",
            background: "#eff6ff",
            borderRadius: "0.25rem",
            fontSize: "0.75rem",
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
            三遍审校中...
          </div>
          {/* Progress bar */}
          <div style={{
            height: "4px",
            background: "#e3e2e2",
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div style={{
              width: "66%",
              height: "100%",
              background: "#3B82F6",
              borderRadius: "2px",
              animation: "pulse 2s ease-in-out infinite",
            }} />
          </div>
          <div style={{ fontSize: "0.625rem", color: "#747878", textAlign: "center" }}>
            Pass 1: 事实核查 → Pass 2: 反AI洗稿 → Pass 3: 节奏格式
          </div>
        </div>
      )}

      {result?.text && status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{
            padding: "0.375rem 0.5rem",
            background: "#f0fdf4",
            borderRadius: "0.25rem",
            fontSize: "0.6875rem",
            color: "#166534",
            fontWeight: 600,
          }}>
            ✓ 三遍审校完成
          </div>
          <div style={{
            padding: "0.5rem",
            background: "#f0fdf4",
            borderRadius: "0.25rem",
            fontSize: "0.6875rem",
            color: "#166534",
            maxHeight: "100px",
            overflow: "auto",
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}>
            {result.text.slice(0, 300)}{result.text.length > 300 ? "..." : ""}
          </div>
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          三遍审校：事实核查 → 反AI洗稿 → 节奏格式
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem",
          background: "#fef2f2",
          borderRadius: "0.25rem",
          fontSize: "0.6875rem",
          color: "#991b1b",
        }}>
          执行失败，请检查 API Key
        </div>
      )}
    </NodeBase>
  )
}
