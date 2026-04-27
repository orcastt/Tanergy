import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import DrawingCanvas from "./DrawingCanvas"
import { useDrawingStore } from "./drawingStore"
import { editorColors, editorShadows, primaryButtonStyle } from "../../styles/editorDesign"

interface Props {
  image: { file_path: string; description: string } | null
  onAiEdit: (instruction: string) => void
}

const COLORS = ["#ff0000", "#ff8800", "#ffff00", "#00cc00", "#0066ff", "#9933ff", "#000000", "#ffffff"]
const WIDTHS = [2, 4, 8, 12]

export default function DrawingPanel({ image, onAiEdit }: Props) {
  const { t } = useTranslation()
  const { color, width, eraser, setColor, setWidth, setEraser, undo, clear } = useDrawingStore()
  const [bgSrc, setBgSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!image) return
    invoke<number[]>("read_asset_file", { filePath: image.file_path })
      .then((bytes) => {
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        setBgSrc(`data:image/png;base64,${base64}`)
      })
      .catch(() => setBgSrc(null))
  }, [image])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Toolbar */}
      <div style={{
        padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem",
        boxShadow: editorShadows.insetBottom, flexShrink: 0, flexWrap: "wrap",
      }}>
        {COLORS.map((c) => (
          <button key={c} onClick={() => { setColor(c); setEraser(false) }} style={{
            width: "20px", height: "20px", borderRadius: "50%", border: "none", boxShadow: color === c && !eraser ? editorShadows.focus : editorShadows.ring,
            background: c, cursor: "pointer", padding: 0,
          }} />
        ))}
        <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />
        {WIDTHS.map((w) => (
          <button key={w} onClick={() => setWidth(w)} style={{
            width: "24px", height: "24px", borderRadius: "0.25rem", border: "none", boxShadow: width === w ? editorShadows.focus : editorShadows.ring,
            background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}>
            <div style={{ width: `${w}px`, height: `${w}px`, borderRadius: "50%", background: "var(--text-primary)" }} />
          </button>
        ))}
        <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />
        <ToolBtn icon="ink_eraser" active={eraser} onClick={() => setEraser(!eraser)} title={t("image_editor.toolbar.eraser")} />
        <ToolBtn icon="undo" onClick={undo} title={t("image_editor.toolbar.undo")} />
        <ToolBtn icon="delete" onClick={clear} title={t("image_editor.toolbar.clear")} />
        <div style={{ flex: 1 }} />
        <button onClick={() => {
          const instruction = window.prompt(t("image_editor.ai.promptDialog"))
          if (instruction?.trim()) onAiEdit(instruction.trim())
        }} disabled={!bgSrc} style={{
          ...primaryButtonStyle,
          cursor: bgSrc ? "pointer" : "not-allowed", opacity: bgSrc ? 1 : 0.4,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_fix_high</span>
          {t("image_editor.toolbar.aiEdit")}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", background: "#1a1a1a" }}>
        <DrawingCanvas backgroundImage={image ? bgSrc : null} width={600} height={450} />
      </div>

    </div>
  )
}

function ToolBtn({ icon, onClick, active, title }: { icon: string; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: "28px", height: "28px", borderRadius: "0.25rem", border: "none",
      background: active ? editorColors.primary : "transparent",
      color: active ? "#fff" : "var(--text-secondary)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
    </button>
  )
}

// local invoke reference
function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return import("@tauri-apps/api/core").then(({ invoke }) => invoke<T>(cmd, args))
}
