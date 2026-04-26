import { useCallback, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useOverlayStore } from "../../store/overlayStore"
import { useCanvasStore } from "../../store/canvasStore"
import TiptapEditor from "./TiptapEditor"
import WeChatPreview from "./WeChatPreview"
import HtmlRewritePopup from "./HtmlRewritePopup"
import { toStandardPurpleHtml } from "./standardPurpleHtml"
import { hasLocalAssetImage, hydrateLocalImageHtml } from "./localImageHtml"

function getPlainTextFromHtml(html: string) {
  const container = document.createElement("div")
  container.innerHTML = html
  return container.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? ""
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  textarea.style.top = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("copy command failed")
}

async function copyRichHtmlToClipboard(html: string) {
  const plainText = getPlainTextFromHtml(html)

  if (navigator.clipboard?.write && "ClipboardItem" in window) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ])
    return
  }

  const container = document.createElement("div")
  container.contentEditable = "true"
  container.innerHTML = html
  container.style.position = "fixed"
  container.style.left = "-9999px"
  container.style.top = "0"
  container.style.width = "760px"
  container.style.background = "#fff"
  document.body.appendChild(container)

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(container)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const copied = document.execCommand("copy")
  selection?.removeAllRanges()
  container.remove()

  if (!copied) throw new Error("copy command failed")
}

export default function HtmlEditorModal() {
  const nodeId = useOverlayStore((s) => s.htmlEditorNodeId)
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const result = useCanvasStore((s) => nodeId ? s.nodeResults[nodeId] : undefined) as
    | { html?: string; word_count?: number; reading_time?: number }
    | undefined

  const initialHtml = useMemo(() => {
    const nodeHtml = node?.data?.editedHtml
    return hydrateLocalImageHtml(result?.html ?? (typeof nodeHtml === "string" ? nodeHtml : ""))
  }, [node?.data?.editedHtml, result?.html])

  const [html, setHtml] = useState(() => initialHtml)
  const [showRewrite, setShowRewrite] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const rewriteInsertRef = useRef<((rewrittenHtml: string) => void) | null>(null)

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

  function handleAiRewrite(text: string, insertRewrittenHtml: (rewrittenHtml: string) => void) {
    setSelectedText(text)
    rewriteInsertRef.current = insertRewrittenHtml
    setShowRewrite(true)
  }

  function handleRewriteResult(rewrittenHtml: string) {
    setShowRewrite(false)
    rewriteInsertRef.current?.(rewrittenHtml)
    rewriteInsertRef.current = null
  }

  const closeRewrite = useCallback(() => {
    rewriteInsertRef.current = null
    setShowRewrite(false)
  }, [])

  const copyForWeChat = useCallback(async () => {
    const standardHtml = hydrateLocalImageHtml(toStandardPurpleHtml(html))
    if (!standardHtml.trim()) {
      setCopyStatus("没有可复制的 HTML 内容")
      return
    }

    if (hasLocalAssetImage(standardHtml)) {
      setCopyStatus("本地图片仅支持预览，公众号正式复制需上线远程 URL")
      return
    }

    try {
      await copyRichHtmlToClipboard(standardHtml)
      setCopyStatus("已复制富文本，可直接粘贴到公众号编辑器")
    } catch {
      try {
        await copyTextToClipboard(standardHtml)
        setCopyStatus("富文本复制失败，已改为复制 HTML 源码")
      } catch {
        setCopyStatus("复制失败，请检查浏览器剪贴板权限")
      }
    }
  }, [html])

  const copySourceHtml = useCallback(async () => {
    const standardHtml = hydrateLocalImageHtml(toStandardPurpleHtml(html))
    if (!standardHtml.trim()) {
      setCopyStatus("没有可复制的 HTML 内容")
      return
    }

    try {
      await copyTextToClipboard(standardHtml)
      setCopyStatus("已复制 HTML 源码")
    } catch {
      setCopyStatus("复制源码失败，请检查浏览器剪贴板权限")
    }
  }, [html])

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {copyStatus && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {copyStatus}
            </span>
          )}
          <button
            onClick={copySourceHtml}
            style={{
              padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid #e2e2e2",
              background: "#fff", color: "#333", fontSize: "0.8125rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>code</span>
            复制源码
          </button>
          <button
            onClick={copyForWeChat}
            style={{
              padding: "0.375rem 0.75rem", borderRadius: 6, border: "none",
              background: "#242424", color: "#fff", fontSize: "0.8125rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
            复制到公众号
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
          onClose={closeRewrite}
        />
      )}
    </div>,
    document.body
  )
}
