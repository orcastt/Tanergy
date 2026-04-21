import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

interface WriterData {
  nodeType: string
  target_words: number
  style: string
}

export default function WriterNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as WriterData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>edit</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      {/* Style selector */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
        {["深度解析", "轻松科普", "情感共鸣", "干货清单"].map((s) => (
          <button
            key={s}
            onClick={() => updateNodeData(id, { style: s })}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.625rem",
              borderRadius: "9999px",
              border: d.style === s ? "1px solid #6349EA" : "1px solid #e3e2e2",
              background: d.style === s ? "#f5f3ff" : "#ffffff",
              color: d.style === s ? "#6349EA" : "#747878",
              cursor: "pointer",
              fontWeight: d.style === s ? 600 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Target words */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "#747878" }}>字数:</span>
        <select
          value={d.target_words ?? 3000}
          onChange={(e) => updateNodeData(id, { target_words: Number(e.target.value) })}
          style={{
            fontSize: "0.6875rem", border: "1px solid #e3e2e2",
            borderRadius: "0.25rem", padding: "0.125rem 0.25rem",
            outline: "none", color: "#1b1c1c",
          }}
        >
          {[1000, 2000, 3000, 5000].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      {status === "running" && (
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
          正在撰写长文...
        </div>
      )}

      {result?.text && status === "done" && (
        <div style={{
          marginTop: "0.25rem",
          padding: "0.5rem",
          background: "#f0fdf4",
          borderRadius: "0.25rem",
          fontSize: "0.6875rem",
          color: "#166534",
          maxHeight: "120px",
          overflow: "auto",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}>
          {result.text.slice(0, 400)}{result.text.length > 400 ? "..." : ""}
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
