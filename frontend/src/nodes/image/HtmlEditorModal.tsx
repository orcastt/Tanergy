import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useOverlayStore } from "../../store/overlayStore"
import { useCanvasStore } from "../../store/canvasStore"
import TiptapEditor from "./TiptapEditor"
import WeChatPreview from "./WeChatPreview"
import HtmlRewritePopup from "./HtmlRewritePopup"

export default function HtmlEditorModal() {
  const nodeId = useOverlayStore((s) => s.htmlEditorNodeId)
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const result = useCanvasStore((s) => nodeId ? s.nodeResults[nodeId] : undefined) as
    | { html?: string; word_count?: number; reading_time?: number }
    | undefined

  const initialHtml = useMemo(() => {
    const nodeHtml = node?.data?.editedHtml
    return result?.html ?? (typeof nodeHtml === "string" ? nodeHtml : "")
  }, [node?.data?.editedHtml, result?.html])

  const [html, setHtml] = useState(initialHtml)
  const [showRewrite, setShowRewrite] = useState(false)
  const [selectedText, setSelectedText] = useState("")

  useEffect(() => {
    setHtml(initialHtml)
  }, [initialHtml, nodeId])

  const persistHtml = useCallback((nextHtml: string, persistToNodeData = false) => {
    if (!nodeId) return
    const plainText = nextHtml.replace(/<[^>]*>/g, "")
    const wordCount = plainText.replace(/\s/g, "").length
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as Record<string, unknown> | undefined
    useCanvasStore.getState().setNodeResult(nodeId, {
      ...currentResult,
      html: nextHtml,
      word_count: wordCount,
      reading_time: Math.max(1, Math.ceil(wordCount / 400)),
    })
    if (persistToNodeData) {
      useCanvasStore.getState().updateNodeData(nodeId, { editedHtml: nextHtml })
    }
  }, [nodeId])

  const close = useCallback(() => {
    persistHtml(html, true)
    useOverlayStore.getState().closeHtmlEditor()
  }, [html, persistHtml])

  const handleUpdate = useCallback((newHtml: string) => {
    setHtml(newHtml)
    persistHtml(newHtml)
  }, [persistHtml])

  function handleAiRewrite(text: string) {
    setSelectedText(text)
    setShowRewrite(true)
  }

  function handleRewriteResult(rewrittenHtml: string) {
    setShowRewrite(false)
    const nextHtml = `${html}\n<p>${rewrittenHtml}</p>`
    setHtml(nextHtml)
    persistHtml(nextHtml)
  }

  if (!nodeId) return null

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        display: "flex", flexDirection: "column",
        background: "var(--bg-canvas, #f5f5f5)",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 1rem",
        borderBottom: "1px solid var(--border-color)",
        background: "#fff",
        flexShrink: 0,
        height: 48,
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={close}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", padding: "0.25rem" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Html Editor</span>
          {result?.word_count != null && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {result.word_count.toLocaleString()} 字 · 约 {result.reading_time} 分钟
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(html).catch(() => {})
                .then(() => alert("HTML 已复制到剪贴板"))
            }}
            style={{
              padding: "0.375rem 0.75rem", borderRadius: 6, border: "none",
              background: "#242424", color: "#fff", fontSize: "0.8125rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
            复制 HTML
          </button>
        </div>
      </div>

      {/* Body: editor + preview */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: editor */}
        <div style={{ flex: 1, overflow: "hidden", borderRight: "1px solid var(--border-color)" }}>
          <TiptapEditor
            content={html}
            onUpdate={handleUpdate}
            onAiRewrite={handleAiRewrite}
          />
        </div>
        {/* Right: preview */}
        <div style={{ flex: 1, overflow: "auto", background: "#f5f5f5" }}>
          <WeChatPreview html={html} />
        </div>
      </div>

      {/* AI Rewrite popup */}
      {showRewrite && (
        <HtmlRewritePopup
          selectedText={selectedText}
          onResult={handleRewriteResult}
          onClose={() => setShowRewrite(false)}
        />
      )}
    </div>,
    document.body
  )
}
