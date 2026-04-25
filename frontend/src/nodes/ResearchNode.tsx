import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"

interface ResearchData {
  nodeType: string
  query: string
  model?: string
  direction?: string
}

const DIRECTIONS = ["行业分析", "案例研究", "数据洞察", "趋势预测"]

export default function ResearchNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as ResearchData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>search</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>Model:</span>
        <ModelSelector
          category="text"
          value={d.model as string | undefined}
          onChange={(model) => updateNodeData(id, { model })}
        />
      </div>
      {/* Direction chips — shown when idle or done */}
      {(status === "idle" || status === "done") && (
        <div style={{ marginBottom: "0.375rem" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>研究方向（可选）</div>
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                onClick={() => updateNodeData(id, { direction: d.direction === dir ? "" : dir })}
                className="nodrag nopan"
                style={{
                  padding: "0.125rem 0.5rem", fontSize: "0.625rem", borderRadius: "9999px",
                  border: d.direction === dir ? "1px solid #7C3AED" : "1px solid var(--border-color)",
                  background: d.direction === dir ? "#f5f3ff" : "transparent",
                  color: d.direction === dir ? "#7C3AED" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: d.direction === dir ? 600 : 400,
                }}
              >{dir}</button>
            ))}
          </div>
        </div>
      )}
      <input
        value={d.query ?? ""}
        onChange={(e) => updateNodeData(id, { query: e.target.value })}
        placeholder="搜索关键词（可选，默认取上游输入）"
        style={{
          width: "100%",
          border: "1px solid #e3e2e2",
          borderRadius: "0.375rem",
          padding: "0.375rem 0.5rem",
          fontSize: "0.8125rem",
          color: "#1b1c1c",
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
      {status === "running" && (
        <div style={{
          marginTop: "0.5rem",
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
          正在调研中...
        </div>
      )}
      {result?.text && status === "done" && (
        <div style={{
          marginTop: "0.5rem",
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
          {result.text.slice(0, 300)}{result.text.length > 300 ? "..." : ""}
        </div>
      )}
      {status === "error" && (
        <div style={{
          marginTop: "0.5rem",
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
