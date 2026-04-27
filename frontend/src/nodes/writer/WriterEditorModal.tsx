import { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useCanvasStore } from "../../store/canvasStore"
import { useOverlayStore } from "../../store/overlayStore"
import { editorColors, editorShadows, editorTypography, iconButtonStyle, primaryButtonStyle, secondaryButtonStyle } from "../../styles/editorDesign"
import BookPreview from "./BookPreview"

function plainTextFromResult(result: unknown) {
  if (result && typeof result === "object" && "text" in (result as Record<string, unknown>)) {
    return String((result as { text?: unknown }).text ?? "")
  }
  return ""
}

export default function WriterEditorModal() {
  const { t } = useTranslation()
  const nodeId = useOverlayStore((s) => s.writerEditorNodeId)
  const node = useCanvasStore((s) => s.nodes.find((item) => item.id === nodeId))
  const result = useCanvasStore((s) => nodeId ? s.nodeResults[nodeId] : undefined)
  const initialText = useMemo(() => String(node?.data?.editedText ?? plainTextFromResult(result)), [node?.data?.editedText, result])
  const [text, setText] = useState(initialText)
  const wordCount = text.replace(/\s/g, "").length
  const title = getDraftTitle(text, String(node?.data?.style ?? t("writer_editor.untitled")))

  const persist = useCallback((nextText: string, persistToNodeData = false) => {
    if (!nodeId) return
    const count = nextText.replace(/\s/g, "").length
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as Record<string, unknown> | undefined
    useCanvasStore.getState().setNodeResult(nodeId, {
      ...currentResult,
      text: nextText,
      word_count: count,
      reading_time: Math.max(1, Math.ceil(count / 400)),
    })
    if (persistToNodeData) {
      useCanvasStore.getState().updateNodeData(nodeId, { editedText: nextText })
    }
  }, [nodeId])

  const updateText = useCallback((nextText: string) => {
    setText(nextText)
    persist(nextText)
  }, [persist])

  const close = useCallback(() => {
    persist(text, true)
    useOverlayStore.getState().closeWriterEditor()
  }, [persist, text])

  if (!nodeId) return null

  return createPortal(
    <div style={modalStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={close} style={iconButtonStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div>
            <div style={{ ...editorTypography.title, fontSize: "1rem" }}>{t("writer_editor.title")}</div>
            <div style={{ fontSize: 12, color: editorColors.secondary }}>
              {t("writer_editor.stats", { count: wordCount.toLocaleString(), time: Math.max(1, Math.ceil(wordCount / 400)) })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => navigator.clipboard.writeText(text).catch(() => {})} style={secondaryButtonStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
            {t("writer_editor.copyText")}
          </button>
          <button onClick={close} style={primaryButtonStyle}>{t("writer_editor.done")}</button>
        </div>
      </header>
      <main style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(420px, 0.9fr) minmax(520px, 1.1fr)", overflow: "hidden" }}>
        <section style={editorPaneStyle}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...editorTypography.label, color: editorColors.secondary }}>{t("writer_editor.editorLabel")}</div>
            <div style={{ fontSize: 12, color: editorColors.secondary, marginTop: 4 }}>{t("writer_editor.editorHint")}</div>
          </div>
          <textarea
            value={text}
            onChange={(event) => updateText(event.target.value)}
            spellCheck={false}
            style={textareaStyle}
            placeholder={t("writer_editor.placeholder")}
          />
        </section>
        <BookPreview text={text} title={title} />
      </main>
    </div>,
    document.body
  )
}

function getDraftTitle(text: string, fallback: string) {
  const firstHeading = text.split("\n").find((line) => line.trim().startsWith("#"))
  if (firstHeading) return firstHeading.replace(/^#+\s*/, "").trim() || fallback
  const firstLine = text.split("\n").find((line) => line.trim())
  return firstLine?.trim().slice(0, 32) || fallback
}

const modalStyle = { position: "fixed", inset: 0, zIndex: 10000, display: "flex", flexDirection: "column", background: editorColors.canvas } as const
const headerStyle = { height: 56, padding: "0.5rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.92)", boxShadow: editorShadows.insetBottom, backdropFilter: "blur(12px)", boxSizing: "border-box", flexShrink: 0 } as const
const editorPaneStyle = { padding: "1.25rem", background: editorColors.surface, boxShadow: editorShadows.insetRight, display: "flex", flexDirection: "column", minWidth: 0 } as const
const textareaStyle = { flex: 1, resize: "none", border: "1px solid var(--border-color)", borderRadius: 14, padding: "1.25rem", background: "#FFFEFC", color: "var(--text-primary)", outline: "none", fontSize: 16, lineHeight: 1.85, fontFamily: "'Noto Serif SC','Songti SC',serif", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" } as const
