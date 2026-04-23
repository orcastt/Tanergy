import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"

interface ImagePlan {
  id: string
  position: string
  description: string
  prompt: string
  aspect_ratio: string
}

export default function ImagePlannerNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string; count: number; style: string; model?: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { t } = useTranslation()
  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { image_plans?: ImagePlan[] } | undefined

  const plans = result?.image_plans ?? []

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>image</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      {/* Model selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>Model:</span>
        <ModelSelector
          category="text"
          value={d.model as string | undefined}
          onChange={(model) => updateNodeData(id, { model })}
        />
      </div>

      {/* Config */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.375rem", alignItems: "center" }}>
        <span style={{ fontSize: "0.6875rem", color: "#747878" }}>{t("nodes.image_planner.count")}</span>
        <select
          value={d.count ?? 3}
          onChange={(e) => updateNodeData(id, { count: Number(e.target.value) })}
          style={{
            fontSize: "0.6875rem", border: "1px solid #e3e2e2",
            borderRadius: "0.25rem", padding: "0.125rem 0.25rem", outline: "none", color: "#1b1c1c",
          }}
        >
          {[1, 3, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.6875rem", color: "#747878", marginLeft: "0.25rem" }}>{t("nodes.image_planner.style")}</span>
        <select
          value={d.style ?? "写实"}
          onChange={(e) => updateNodeData(id, { style: e.target.value })}
          style={{
            fontSize: "0.6875rem", border: "1px solid #e3e2e2",
            borderRadius: "0.25rem", padding: "0.125rem 0.25rem", outline: "none", color: "#1b1c1c",
          }}
        >
          {["写实", "插画", "简约", "油画"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {status === "running" && (
        <div style={{
          padding: "0.5rem", background: "#eff6ff", borderRadius: "0.25rem",
          fontSize: "0.75rem", color: "#1d4ed8",
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
          {t("nodes.image_planner.analyzing")}
        </div>
      )}

      {plans.length > 0 && status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {plans.map((plan, i) => (
            <div key={plan.id ?? i} style={{
              padding: "0.375rem 0.5rem", background: "#f5f3ff",
              borderRadius: "0.25rem", fontSize: "0.6875rem",
            }}>
              <div style={{ fontWeight: 600, color: "#6d28d9", marginBottom: "0.125rem" }}>
                图 {i + 1}: {plan.position}
              </div>
              <div style={{ color: "#374151" }}>{plan.description}</div>
              <div style={{ color: "#9ca3af", fontSize: "0.625rem", marginTop: "0.125rem" }}>
                {plan.aspect_ratio} · {plan.prompt.slice(0, 60)}{plan.prompt.length > 60 ? "..." : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          {t("nodes.image_planner.connectHint")}
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          {t("nodes.image_planner.error")}
        </div>
      )}
    </NodeBase>
  )
}
