import { useState, useEffect } from "react"
import DrawingCanvas from "./DrawingCanvas"
import AiEditPopup from "./AiEditPopup"
import { useDrawingStore } from "./drawingStore"
import ImageThumb from "./ImageThumb"

interface Props {
  image: { file_path: string; description: string } | null
  onAiEdit: (instruction: string) => void
}

const COLORS = ["#ff0000", "#ff8800", "#ffff00", "#00cc00", "#0066ff", "#9933ff", "#000000", "#ffffff"]
const WIDTHS = [2, 4, 8, 12]

export default function DrawingPanel({ image, onAiEdit }: Props) {
  const { color, width, eraser, setColor, setWidth, setEraser, undo, clear } = useDrawingStore()
  const [bgSrc, setBgSrc] = useState<string | null>(null)
  const [showAiPopup, setShowAiPopup] = useState(false)

  useEffect(() => {
    if (!image) { setBgSrc(null); return }
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
        borderBottom: "1px solid var(--border-color)", flexShrink: 0, flexWrap: "wrap",
      }}>
        {COLORS.map((c) => (
          <button key={c} onClick={() => { setColor(c); setEraser(false) }} style={{
            width: "20px", height: "20px", borderRadius: "50%", border: color === c && !eraser ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
            background: c, cursor: "pointer", padding: 0,
          }} />
        ))}
        <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />
        {WIDTHS.map((w) => (
          <button key={w} onClick={() => setWidth(w)} style={{
            width: "24px", height: "24px", borderRadius: "0.25rem", border: width === w ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
            background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}>
            <div style={{ width: `${w}px`, height: `${w}px`, borderRadius: "50%", background: "var(--text-primary)" }} />
          </button>
        ))}
        <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />
        <ToolBtn icon="ink_eraser" active={eraser} onClick={() => setEraser(!eraser)} title="Eraser" />
        <ToolBtn icon="undo" onClick={undo} title="Undo" />
        <ToolBtn icon="delete" onClick={clear} title="Clear" />
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAiPopup(true)} disabled={!bgSrc} style={{
          padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "none",
          background: "#6349EA", color: "#fff", fontSize: "0.6875rem", fontWeight: 600,
          cursor: bgSrc ? "pointer" : "not-allowed", opacity: bgSrc ? 1 : 0.4,
          display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_fix_high</span>
          AI Edit
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: "hidden", background: "#1a1a1a" }}>
        <DrawingCanvas backgroundImage={bgSrc} width={600} height={450} />
      </div>

      {showAiPopup && <AiEditPopup onSubmit={onAiEdit} onClose={() => setShowAiPopup(false)} />}
    </div>
  )
}

function ToolBtn({ icon, onClick, active, title }: { icon: string; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: "28px", height: "28px", borderRadius: "0.25rem", border: "none",
      background: active ? "var(--bg-hover)" : "transparent",
      color: active ? "#6349EA" : "var(--text-secondary)",
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
