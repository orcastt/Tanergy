import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { rasterizeLayers } from "./LayerCanvas"

interface Props {
  onResult: (base64: string) => void
  onClose: () => void
}

type Status = "input" | "analyzing" | "generating" | "done" | "error"

export default function AiEditPopup({ onResult, onClose }: Props) {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("input")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit() {
    if (!text.trim()) return

    const imageDataUrl = rasterizeLayers()
    if (!imageDataUrl) { setErrorMsg("画板未就绪"); return }
    const imageBase64 = imageDataUrl.replace(/^data:image\/png;base64,/, "")

    setStatus("analyzing")
    setErrorMsg("")

    try {
      setStatus("generating")
      const result = await invoke<{ base64: string; size: number }>("ai_edit_image", {
        imageBase64,
        instruction: text.trim(),
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
    analyzing: "正在分析图片...",
    generating: "正在生成新图片...",
    done: "生成完成",
    error: `生成失败: ${errorMsg}`,
  }

  const progress = status === "analyzing" ? 30 : status === "generating" ? 70 : status === "done" ? 100 : 0
  const isLoading = status === "analyzing" || status === "generating"

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
    }} onClick={isLoading ? undefined : onClose}>
      <div style={{
        background: "var(--bg-surface)", borderRadius: "0.75rem", padding: "1.25rem",
        width: "400px", boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#6349EA" }}>auto_fix_high</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
            AI 图片编辑
          </span>
        </div>

        {/* Text input */}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          placeholder="描述你想要的编辑效果...&#10;例如：把背景换成海边、增加暖色调、添加一只猫"
          style={{
            width: "100%", height: "80px", padding: "0.5rem 0.75rem",
            border: "1px solid var(--border-color)", borderRadius: "0.375rem",
            fontSize: "0.8125rem", resize: "none", outline: "none",
            fontFamily: '"Inter", sans-serif', color: "var(--text-primary)",
            background: "var(--bg-input)",
            opacity: isLoading ? 0.6 : 1,
          }}
        />

        {/* Progress bar */}
        {status !== "input" && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{
              fontSize: "0.6875rem", color: status === "error" ? "#EF4444" : status === "done" ? "#22C55E" : "#6349EA",
              marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.25rem",
            }}>
              {isLoading && (
                <span className="material-symbols-outlined" style={{ fontSize: "12px", animation: "spin 1s linear infinite" }}>progress_activity</span>
              )}
              {statusText[status]}
            </div>
            <div style={{
              height: "4px", background: "var(--border-color)", borderRadius: "2px", overflow: "hidden",
            }}>
              <div style={{
                width: `${progress}%`, height: "100%",
                background: status === "error" ? "#EF4444" : status === "done" ? "#22C55E" : "#6349EA",
                borderRadius: "2px", transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button onClick={onClose} disabled={isLoading} style={{
            padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
            background: "var(--bg-hover)", color: "var(--text-primary)",
            fontSize: "0.8125rem", cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.5 : 1,
          }}>取消</button>
          {status === "error" ? (
            <button onClick={handleSubmit} style={{
              padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
              background: "#6349EA", color: "#fff", fontSize: "0.8125rem", cursor: "pointer",
            }}>重试</button>
          ) : status === "done" ? (
            <button onClick={onClose} style={{
              padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
              background: "#22C55E", color: "#fff", fontSize: "0.8125rem", cursor: "pointer",
            }}>完成</button>
          ) : (
            <button onClick={handleSubmit} disabled={isLoading || !text.trim()} style={{
              padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none",
              background: "#6349EA", color: "#fff", fontSize: "0.8125rem",
              cursor: isLoading || !text.trim() ? "not-allowed" : "pointer",
              opacity: !text.trim() ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: "0.25rem",
            }}>
              {isLoading && <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>}
              {isLoading ? "生成中..." : "生成"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
