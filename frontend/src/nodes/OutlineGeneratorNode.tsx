import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"

interface OutlineData {
  nodeType: string
  style: string
  model?: string
}

export default function OutlineGeneratorNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as OutlineData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { t } = useTranslation()
  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { options?: Array<{ title: string; angle: string; sections: string[] }>; raw?: string } | undefined

  const options = result?.options

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>format_list_bulleted</span>}
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
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {["干货清单", "故事叙事", "深度分析"].map((s) => (
          <button
            key={s}
            onClick={() => updateNodeData(id, { style: s })}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              borderRadius: "9999px",
              border: d.style === s ? "1px solid #7C3AED" : "1px solid #e3e2e2",
              background: d.style === s ? "#f5f3ff" : "#ffffff",
              color: d.style === s ? "#7C3AED" : "#747878",
              cursor: "pointer",
              fontWeight: d.style === s ? 600 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>
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
          {t("nodes.outline.generating")}
        </div>
      )}
      {options && status === "done" && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {options.map((opt, i) => (
            <div key={i} style={{
              padding: "0.375rem 0.5rem",
              background: "#f5f3ff",
              borderRadius: "0.25rem",
              fontSize: "0.6875rem",
            }}>
              <div style={{ fontWeight: 600, color: "#7C3AED" }}>{opt.title}</div>
              <div style={{ color: "#5e5e5e", marginTop: "0.125rem" }}>{opt.angle}</div>
            </div>
          ))}
        </div>
      )}
      {result?.raw && !options && status === "done" && (
        <div style={{
          marginTop: "0.5rem",
          padding: "0.5rem",
          background: "#f5f3ff",
          borderRadius: "0.25rem",
          fontSize: "0.6875rem",
          color: "#5e5e5e",
          maxHeight: "100px",
          overflow: "auto",
          whiteSpace: "pre-wrap",
        }}>
          {result.raw.slice(0, 200)}...
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
          {t("common.errorApiKey")}
        </div>
      )}
    </NodeBase>
  )
}
