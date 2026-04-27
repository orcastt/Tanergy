import { useState } from "react"
import { useTranslation } from "react-i18next"
import { tauri } from "../../services/tauri"
import { editorColors, editorShadows, editorTypography, iconButtonStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../../styles/editorDesign"
import ModelSelector from "../../components/ModelSelector"
import { DEFAULT_MODELS } from "../modelDefs"

interface HtmlRewritePopupProps {
  selectedText: string
  onResult: (rewrittenHtml: string) => void
  onClose: () => void
}

type Status = "input" | "generating" | "done" | "error"

export default function HtmlRewritePopup({ selectedText, onResult, onClose }: HtmlRewritePopupProps) {
  const { t } = useTranslation()
  const [instruction, setInstruction] = useState("")
  const [status, setStatus] = useState<Status>("input")
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<string | null>(null)
  const [model, setModel] = useState(DEFAULT_MODELS.text)

  async function handleSubmit() {
    if (!instruction.trim()) return
    setStatus("generating")
    setError(null)
    try {
      const result = await tauri.aiRewriteHtml(selectedText, instruction.trim(), model)
      setGenerated(result)
      setStatus("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus("error")
    }
  }

  function handleInsert() {
    if (generated) {
      onResult(generated)
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 10001,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(36,36,36,0.36)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{
        width: 480, maxHeight: "80vh",
        background: editorColors.surface,
        borderRadius: 12,
        boxShadow: editorShadows.modal,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "0.75rem 1rem",
          boxShadow: editorShadows.insetBottom,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ ...editorTypography.title, fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_fix_high</span>
            {t("html_editor.rewrite.title")}
          </span>
          <button onClick={onClose} style={{ ...iconButtonStyle, width: 28, height: 28 }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {/* Selected text preview */}
        {selectedText && (
          <div style={{
            padding: "0.5rem 1rem",
            background: editorColors.hover,
            fontSize: "0.75rem", color: "var(--text-secondary)",
            boxShadow: editorShadows.insetBottom,
            overflow: "hidden",
          }}>
            <span style={{ fontWeight: 600 }}>{t("html_editor.rewrite.selectedText")}</span>
            {selectedText.slice(0, 100)}{selectedText.length > 100 ? "..." : ""}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "1rem", overflow: "auto", flex: 1 }}>
          {status === "input" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ ...editorTypography.label, minWidth: 44 }}>{t("nodes.model")}</span>
                <ModelSelector category="text" value={model} onChange={setModel} />
              </div>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t("html_editor.rewrite.placeholder")}
                autoFocus
                style={{
                  ...inputStyle, minHeight: 100, resize: "vertical",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
                }}
              />
              <div style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                {t("html_editor.rewrite.shortcut")}
              </div>
            </>
          )}

          {status === "generating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "1rem 0" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "32px", animation: "spin 1s linear infinite", color: editorColors.primary }}>progress_activity</span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{t("html_editor.rewrite.loading")}</span>
            </div>
          )}

          {status === "done" && generated && (
            <div>
              <div style={{ ...editorTypography.label, marginBottom: "0.5rem", color: editorColors.success }}>{t("html_editor.rewrite.result")}</div>
              <div style={{
                padding: "0.75rem",
                background: editorColors.hover,
                borderRadius: 8,
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                maxHeight: 200,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                color: "var(--text-primary)",
              }}>
                {generated}
              </div>
            </div>
          )}

          {status === "error" && (
            <div style={{ color: "#ef4444", fontSize: "0.8125rem" }}>
              {t("html_editor.rewrite.error", { error })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "0.75rem 1rem",
          boxShadow: "inset 0 1px 0 rgba(0,0,0,0.05)",
          display: "flex", gap: "0.5rem", justifyContent: "flex-end",
        }}>
          {status === "input" && (
            <>
              <button onClick={onClose} style={secondaryButtonStyle}>{t("common.cancel")}</button>
              <button
                onClick={handleSubmit}
                disabled={!instruction.trim()}
                style={{
                  ...primaryButtonStyle,
                  opacity: instruction.trim() ? 1 : 0.45,
                  cursor: instruction.trim() ? "pointer" : "not-allowed",
                }}
              >{t("html_editor.rewrite.generate")}</button>
            </>
          )}
          {status === "generating" && null}
          {status === "done" && (
            <>
              <button onClick={() => { setStatus("input"); setGenerated(null) }} style={secondaryButtonStyle}>{t("html_editor.rewrite.editAgain")}</button>
              <button
                onClick={handleInsert}
                style={primaryButtonStyle}
              >{t("html_editor.rewrite.insert")}</button>
            </>
          )}
          {status === "error" && (
            <>
              <button onClick={onClose} style={secondaryButtonStyle}>{t("common.close")}</button>
              <button onClick={handleSubmit} style={primaryButtonStyle}>{t("common.retry")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
