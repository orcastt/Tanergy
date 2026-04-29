import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useTranslation } from "react-i18next"
import { rasterizeLayers } from "./layerCanvasRuntime"
import { editorColors, editorShadows, editorTypography, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../../styles/editorDesign"
import ModelSelector from "../../components/ModelSelector"
import { getDefaultModelForCategory } from "../../store/officialModelsStore"

interface Props {
  onResult: (base64: string) => void
  onClose: () => void
}

type Status = "input" | "analyzing" | "generating" | "done" | "error"

export default function AiEditPopup({ onResult, onClose }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("input")
  const [errorMsg, setErrorMsg] = useState("")
  const [model, setModel] = useState(() => getDefaultModelForCategory("image_edit"))

  async function handleSubmit() {
    if (!text.trim()) return

    const imageDataUrl = rasterizeLayers()
    if (!imageDataUrl) { setErrorMsg(t("image_editor.canvasNotReady")); return }
    const imageBase64 = imageDataUrl.replace(/^data:image\/png;base64,/, "")

    setStatus("analyzing")
    setErrorMsg("")

    try {
      setStatus("generating")
      const result = await invoke<{ base64: string; size: number }>("ai_edit_image", {
        imageBase64,
        instruction: text.trim(),
        model,
      })

      setStatus("done")
      onResult(result.base64)
    } catch (e) {
      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const statusText: Record<Status, string> = {
    input: "",
    analyzing: t("image_editor.ai.analyzing"),
    generating: t("image_editor.ai.generating"),
    done: t("image_editor.ai.done"),
    error: t("image_editor.ai.error", { error: errorMsg }),
  }

  const progress = status === "analyzing" ? 30 : status === "generating" ? 70 : status === "done" ? 100 : 0
  const isLoading = status === "analyzing" || status === "generating"

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(36,36,36,0.36)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
    }} onClick={isLoading ? undefined : onClose}>
      <div style={{
        background: editorColors.surface, borderRadius: "0.75rem", padding: "1.25rem",
        width: "400px", boxShadow: editorShadows.modal,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: editorColors.primary }}>auto_fix_high</span>
          <span style={{ ...editorTypography.title, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
            {t("image_editor.ai.title")}
          </span>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          placeholder={t("image_editor.ai.prompt")}
          style={{
            ...inputStyle, height: "80px", resize: "none",
            opacity: isLoading ? 0.6 : 1,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
          <span style={{ ...editorTypography.label, minWidth: 44 }}>{t("nodes.model")}</span>
          <ModelSelector category="image_edit" value={model} onChange={setModel} />
        </div>

        {status !== "input" && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{
              fontSize: "0.6875rem", color: status === "error" ? editorColors.danger : status === "done" ? editorColors.success : editorColors.primary,
              marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.25rem",
            }}>
              {isLoading && (
                <span className="material-symbols-outlined" style={{ fontSize: "12px", animation: "spin 1s linear infinite" }}>progress_activity</span>
              )}
              {statusText[status]}
            </div>
            <div style={{
              height: "4px", background: editorColors.hover, borderRadius: "2px", overflow: "hidden",
            }}>
              <div style={{
                width: `${progress}%`, height: "100%",
                background: status === "error" ? editorColors.danger : status === "done" ? editorColors.success : editorColors.primary,
                borderRadius: "2px", transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button onClick={onClose} disabled={isLoading} style={{ ...secondaryButtonStyle, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}>{t("common.cancel")}</button>
          {status === "error" ? (
            <button onClick={handleSubmit} style={primaryButtonStyle}>{t("common.retry")}</button>
          ) : status === "done" ? (
            <button onClick={onClose} style={primaryButtonStyle}>{t("common.done")}</button>
          ) : (
            <button onClick={handleSubmit} disabled={isLoading || !text.trim()} style={{
              ...primaryButtonStyle,
              cursor: isLoading || !text.trim() ? "not-allowed" : "pointer",
              opacity: !text.trim() ? 0.5 : 1,
            }}>
              {isLoading && <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>}
              {isLoading ? t("image_editor.ai.generatingButton") : t("image_editor.ai.generate")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
