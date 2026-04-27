import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { useOverlayStore } from "../store/overlayStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"

interface WriterData {
  nodeType: string
  target_words: number
  style: string
  model?: string
}

export default function WriterNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as WriterData
  const def = NODE_MAP[d.nodeType]

  const { t } = useTranslation()
  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined
  const hasDraft = Boolean(result?.text || data.editedText)

  if (!def) return null

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
        <span style={{ fontSize: "0.6875rem", color: "#747878" }}>{t("nodes.writer.wordCount")}</span>
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

      {status !== "running" && (
        <button
          onClick={() => useOverlayStore.getState().openWriterEditor(id)}
          className="nodrag nopan"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            padding: "0.45rem 0.5rem",
            marginBottom: "0.375rem",
            border: "none",
            borderRadius: "0.375rem",
            background: "#242424",
            color: "#fff",
            boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px",
            cursor: "pointer",
            fontSize: "0.6875rem",
            fontWeight: 700,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>menu_book</span>
          {hasDraft ? t("nodes.writer.openDraft") : t("nodes.writer.newDraft")}
        </button>
      )}

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
          {t("nodes.writer.writing")}
        </div>
      )}

      {result?.text && status === "done" && (
        <div
          onDoubleClick={() => useOverlayStore.getState().openWriterEditor(id)}
          style={{
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
          cursor: "pointer",
        }}>
          {result.text.slice(0, 400)}{result.text.length > 400 ? "..." : ""}
          <div style={{ marginTop: "0.375rem", fontWeight: 700 }}>{t("nodes.writer.doubleClickEdit")}</div>
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
          {t("common.errorApiKey")}
        </div>
      )}
    </NodeBase>
  )
}
