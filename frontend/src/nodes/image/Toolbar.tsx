import { useTranslation } from "react-i18next"
import { useLayerStore } from "./layerStore"
import { editorColors, editorShadows, primaryButtonStyle } from "../../styles/editorDesign"

const COLORS = ["#ff0000", "#ff8800", "#ffff00", "#00cc00", "#0066ff", "#9933ff", "#000000", "#ffffff"]
const WIDTHS = [2, 4, 8, 12]

interface Props {
  onAiEdit: () => void
}

export default function Toolbar({ onAiEdit }: Props) {
  const { t } = useTranslation()
  const { color, brushWidth, eraser, tool, showGrid, snapEnabled, setColor, setBrushWidth, setEraser, setTool, undoStroke, clearLayerStrokes, toggleGrid, toggleSnap } = useLayerStore()

  return (
    <div style={{
      padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem",
      boxShadow: editorShadows.insetBottom, flexShrink: 0, flexWrap: "wrap",
      background: editorColors.surface,
    }}>
      <ToolSwitchBtn label={t("image_editor.toolbar.select")} icon="near_me" active={tool === "select"} onClick={() => setTool("select")} />
      <ToolSwitchBtn label={t("image_editor.toolbar.brush")} icon="brush" active={tool === "draw"} onClick={() => setTool("draw")} />

      <Divider />

      {COLORS.map((c) => (
        <button key={c} onClick={() => { setColor(c); setEraser(false) }} style={{
          width: "20px", height: "20px", borderRadius: "50%",
          border: "none", boxShadow: color === c && !eraser ? editorShadows.focus : editorShadows.ring,
          background: c, cursor: "pointer", padding: 0,
        }} />
      ))}

      <Divider />

      {WIDTHS.map((w) => (
        <button key={w} onClick={() => setBrushWidth(w)} style={{
          width: "24px", height: "24px", borderRadius: "0.25rem",
          border: "none", boxShadow: brushWidth === w ? editorShadows.focus : editorShadows.ring,
          background: editorColors.surface, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}>
          <div style={{ width: `${w}px`, height: `${w}px`, borderRadius: "50%", background: "var(--text-primary)" }} />
        </button>
      ))}

      <Divider />

      <ToolBtn icon="ink_eraser" active={eraser} onClick={() => setEraser(!eraser)} title={t("image_editor.toolbar.eraser")} />
      <ToolBtn icon="undo" onClick={undoStroke} title={t("image_editor.toolbar.undo")} />
      <ToolBtn icon="delete" onClick={clearLayerStrokes} title={t("image_editor.toolbar.clear")} />

      <Divider />

      <ToolBtn icon="grid_on" active={showGrid} onClick={toggleGrid} title={t("image_editor.toolbar.grid")} />
      <ToolBtn icon="grid_4x4" active={snapEnabled} onClick={toggleSnap} title={t("image_editor.toolbar.snap")} />

      <div style={{ flex: 1 }} />

      <button onClick={onAiEdit} style={primaryButtonStyle}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_fix_high</span>
        {t("image_editor.toolbar.aiEdit")}
      </button>
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

function ToolSwitchBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} style={{
      padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "none",
      boxShadow: active ? editorShadows.focus : editorShadows.ring,
      background: active ? editorColors.primary : editorColors.surface,
      color: active ? "#fff" : "var(--text-secondary)",
      cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", fontWeight: active ? 600 : 400,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
      {label}
    </button>
  )
}

function Divider() {
  return <div style={{ width: "1px", height: "20px", background: "rgba(0,0,0,0.06)", margin: "0 0.25rem" }} />
}
