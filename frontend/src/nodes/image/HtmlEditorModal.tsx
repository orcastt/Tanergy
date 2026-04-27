import { useCallback, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useOverlayStore } from "../../store/overlayStore"
import { useCanvasStore } from "../../store/canvasStore"
import TiptapEditor from "./TiptapEditor"
import WeChatPreview from "./WeChatPreview"
import HtmlRewritePopup from "./HtmlRewritePopup"
import { toStandardPurpleHtml } from "./standardPurpleHtml"
import { hasLocalAssetImage, hydrateLocalImageHtml } from "./localImageHtml"
import { editorColors, editorShadows, editorTypography, iconButtonStyle, primaryButtonStyle, secondaryButtonStyle } from "../../styles/editorDesign"

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
  const { t } = useTranslation()
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
      setCopyStatus(t("html_editor.emptyCopy"))
      return
    }

    if (hasLocalAssetImage(standardHtml)) {
      setCopyStatus(t("html_editor.localImageCopyBlocked"))
      return
    }

    try {
      await copyRichHtmlToClipboard(standardHtml)
      setCopyStatus(t("html_editor.richCopied"))
    } catch {
      try {
        await copyTextToClipboard(standardHtml)
        setCopyStatus(t("html_editor.richFallback"))
      } catch {
        setCopyStatus(t("html_editor.copyFailed"))
      }
    }
  }, [html, t])

  const copySourceHtml = useCallback(async () => {
    const standardHtml = hydrateLocalImageHtml(toStandardPurpleHtml(html))
    if (!standardHtml.trim()) {
      setCopyStatus(t("html_editor.emptyCopy"))
      return
    }

    try {
      await copyTextToClipboard(standardHtml)
      setCopyStatus(t("html_editor.sourceCopied"))
    } catch {
      setCopyStatus(t("html_editor.sourceCopyFailed"))
    }
  }, [html, t])

  if (!nodeId) return null

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        display: "flex", flexDirection: "column",
        background: editorColors.canvas,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 1rem", boxShadow: editorShadows.insetBottom,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        flexShrink: 0,
        height: 56,
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={close}
            style={iconButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <span style={{ ...editorTypography.title, fontSize: "1rem" }}>{t("html_editor.title")}</span>
          {result?.word_count != null && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {t("html_editor.stats", { count: result.word_count.toLocaleString(), time: result.reading_time })}
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
            style={secondaryButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>code</span>
            {t("html_editor.copySource")}
          </button>
          <button
            onClick={copyForWeChat}
            style={primaryButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>content_copy</span>
            {t("html_editor.copyWechat")}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", boxShadow: editorShadows.insetRight }}>
          <TiptapEditor
            content={html}
            onUpdate={handleUpdate}
            onAiRewrite={handleAiRewrite}
          />
        </div>
        <div style={{ flex: 1, overflow: "auto", background: editorColors.canvas }}>
          <WeChatPreview html={html} />
        </div>
      </div>

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
