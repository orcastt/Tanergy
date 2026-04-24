import { useLayerStore } from "./layerStore"

const COLORS = ["#ff0000", "#ff8800", "#ffff00", "#00cc00", "#0066ff", "#9933ff", "#000000", "#ffffff"]
const WIDTHS = [2, 4, 8, 12]

interface Props {
  onAiEdit: () => void
}

export default function Toolbar({ onAiEdit }: Props) {
  const { color, brushWidth, eraser, tool, showGrid, snapEnabled, setColor, setBrushWidth, setEraser, setTool, undoStroke, clearLayerStrokes, toggleGrid, toggleSnap } = useLayerStore()

  return (
    <div style={{
      padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem",
      borderBottom: "1px solid var(--border-color)", flexShrink: 0, flexWrap: "wrap",
      background: "var(--bg-surface)",
    }}>
      {/* Tool switch */}
      <ToolSwitchBtn label="选择" icon="near_me" active={tool === "select"} onClick={() => setTool("select")} />
      <ToolSwitchBtn label="画笔" icon="brush" active={tool === "draw"} onClick={() => setTool("draw")} />

      <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />

      {/* Colors */}
      {COLORS.map((c) => (
        <button key={c} onClick={() => { setColor(c); setEraser(false) }} style={{
          width: "20px", height: "20px", borderRadius: "50%",
          border: color === c && !eraser ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
          background: c, cursor: "pointer", padding: 0,
        }} />
      ))}

      <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />

      {/* Brush widths */}
      {WIDTHS.map((w) => (
        <button key={w} onClick={() => setBrushWidth(w)} style={{
          width: "24px", height: "24px", borderRadius: "0.25rem",
          border: brushWidth === w ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
          background: "var(--bg-surface)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}>
          <div style={{ width: `${w}px`, height: `${w}px`, borderRadius: "50%", background: "var(--text-primary)" }} />
        </button>
      ))}

      <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />

      <ToolBtn icon="ink_eraser" active={eraser} onClick={() => setEraser(!eraser)} title="橡皮擦" />
      <ToolBtn icon="undo" onClick={undoStroke} title="撤销" />
      <ToolBtn icon="delete" onClick={clearLayerStrokes} title="清除当前图层" />

      <div style={{ width: "1px", height: "20px", background: "var(--border-color)", margin: "0 0.25rem" }} />

      <ToolBtn icon="grid_on" active={showGrid} onClick={toggleGrid} title="网格" />
      <ToolBtn icon="grid_4x4" active={snapEnabled} onClick={toggleSnap} title="吸附" />

      <div style={{ flex: 1 }} />

      {/* AI Edit */}
      <button onClick={onAiEdit} style={{
        padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "none",
        background: "#6349EA", color: "#fff", fontSize: "0.6875rem", fontWeight: 600,
        cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_fix_high</span>
        AI Edit
      </button>
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

function ToolSwitchBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} style={{
      padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: active ? "2px solid #6349EA" : "1px solid var(--border-color)",
      background: active ? "rgba(99,73,234,0.1)" : "transparent",
      color: active ? "#6349EA" : "var(--text-secondary)",
      cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", fontWeight: active ? 600 : 400,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
      {label}
    </button>
  )
}
