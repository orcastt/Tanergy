import { useState } from "react"
import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"

export default function HtmlFormatterNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string; style: string; fontSize: number; lineHeight: number; model?: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { t } = useTranslation()
  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { html?: string; word_count?: number; reading_time?: number } | undefined

  const [showEditor, setShowEditor] = useState(false)

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>code</span>}
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
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.6875rem", color: "#747878" }}>{t("nodes.html_formatter.style")}</span>
        <select
          value={d.style ?? "经典"}
          onChange={(e) => updateNodeData(id, { style: e.target.value })}
          style={{ fontSize: "0.6875rem", border: "1px solid #e3e2e2", borderRadius: "0.25rem", padding: "0.125rem 0.25rem", outline: "none", color: "#1b1c1c" }}
        >
          {["经典", "简约", "活泼", "专业"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.6875rem", color: "#747878" }}>{t("nodes.html_formatter.fontSize")}</span>
        <select
          value={d.fontSize ?? 16}
          onChange={(e) => updateNodeData(id, { fontSize: Number(e.target.value) })}
          style={{ fontSize: "0.6875rem", border: "1px solid #e3e2e2", borderRadius: "0.25rem", padding: "0.125rem 0.25rem", outline: "none", color: "#1b1c1c" }}
        >
          {[14, 16, 18].map((n) => (
            <option key={n} value={n}>{n}px</option>
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
          {t("nodes.html_formatter.formatting")}
        </div>
      )}

      {status === "done" && result?.html && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {!showEditor ? (
            <div style={{
              border: "1px solid #e3e2e2", borderRadius: "0.375rem",
              overflow: "hidden", maxHeight: "200px",
            }}>
              <iframe
                srcDoc={result.html}
                sandbox="allow-same-origin"
                style={{ width: "100%", height: "200px", border: "none", pointerEvents: "none" }}
                title="HTML Preview"
              />
            </div>
          ) : (
            <textarea
              value={result.html}
              readOnly
              style={{
                width: "100%", minHeight: "150px", fontSize: "0.625rem",
                fontFamily: "monospace", border: "1px solid #e3e2e2",
                borderRadius: "0.25rem", padding: "0.375rem",
                resize: "vertical", color: "#1b1c1c",
              }}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#9ca3af" }}>
              {t("nodes.html_formatter.stats", { count: result.word_count?.toLocaleString(), time: result.reading_time })}
            </span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                onClick={() => setShowEditor(!showEditor)}
                style={{
                  padding: "0.125rem 0.5rem", fontSize: "0.625rem",
                  border: "1px solid #e3e2e2", borderRadius: "0.25rem",
                  cursor: "pointer", background: "#fff", color: "#1b1c1c",
                }}
              >
                {showEditor ? t("nodes.html_formatter.preview") : t("nodes.html_formatter.editHtml")}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          {t("nodes.html_formatter.connectHint")}
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          {t("nodes.html_formatter.error")}
        </div>
      )}
    </NodeBase>
  )
}
