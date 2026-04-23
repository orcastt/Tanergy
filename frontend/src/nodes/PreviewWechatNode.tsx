import { useState } from "react"
import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

export default function PreviewWechatNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { t } = useTranslation()
  const { nodeStatuses, nodeResults } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { html?: string } | undefined

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const html = result?.html
    if (!html) return
    try {
      const plainText = html.replace(/<[^>]*>/g, "")
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for Tauri webview
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>article</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      {status === "running" && (
        <div style={{
          padding: "0.5rem", background: "#eff6ff", borderRadius: "0.25rem",
          fontSize: "0.75rem", color: "#1d4ed8",
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
          {t("nodes.preview_wechat.loading")}
        </div>
      )}

      {status === "done" && result?.html && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Phone mockup */}
          <div style={{
            width: "100%", maxWidth: "280px", margin: "0 auto",
            background: "#fff", borderRadius: "1rem",
            border: "1px solid #e3e2e2", overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            {/* Status bar */}
            <div style={{
              background: "#f5f3f3", padding: "0.375rem 0.75rem",
              display: "flex", justifyContent: "space-between",
              fontSize: "0.5625rem", color: "#747878",
            }}>
              <span>9:41</span>
              <span>100%</span>
            </div>
            {/* Content */}
            <div style={{ padding: "0.75rem", maxHeight: "300px", overflowY: "auto" }}>
              <div
                dangerouslySetInnerHTML={{ __html: result.html }}
                style={{ fontSize: "13px", lineHeight: "1.6", color: "#333" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1, padding: "0.375rem 0.5rem", fontSize: "0.6875rem",
                background: copied ? "#22C55E" : "#242424", color: "#fff",
                border: "none", borderRadius: "0.375rem", cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              {copied ? t("nodes.preview_wechat.copied") : t("nodes.preview_wechat.copyHtml")}
            </button>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          {t("nodes.preview_wechat.connectHint")}
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          {t("nodes.preview_wechat.error")}
        </div>
      )}
    </NodeBase>
  )
}
