import { useCanvasStore } from "../store/canvasStore"
import { useThemeStore } from "../store/themeStore"
import { useLibraryStore } from "../store/libraryStore"
import { runAll, stopAll } from "../lib/executionEngine"
import { Z } from "./OverlayLayer"

interface Props {
  onAddNode: () => void
}

export default function Toolbar({ onAddNode }: Props) {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useCanvasStore((s) => s.historyIndex > 0)
  const canRedo = useCanvasStore((s) => s.historyIndex < s.history.length - 1 && s.history.length > 0)
  const nodes = useCanvasStore((s) => s.nodes)
  const nodeStatuses = useCanvasStore((s) => s.nodeStatuses)
  const libraryOpen = useLibraryStore((s) => s.open)
  const setLibraryOpen = useLibraryStore((s) => s.setOpen)

  const hasRunningNodes = Object.values(nodeStatuses).some((s) => s === "running")

  return (
    <div style={{
      position: "fixed", left: 0, top: 56, bottom: 0,
      width: "48px", background: "var(--bg-surface)",
      boxShadow: "1px 0 0 0 rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0.75rem 0", gap: "0.25rem", zIndex: Z.TOOLBAR,
      pointerEvents: "auto",
    }}>
      <ToolBtn icon="add" label="Add Node (N)" onClick={onAddNode} />
      <ToolBtn icon="auto_awesome" label="Skills" onClick={() => {}} />
      <ToolBtn icon="folder_open" label="个人素材库" onClick={() => setLibraryOpen(!libraryOpen)} active={libraryOpen} accent />
      <div style={{ width: "24px", height: "1px", background: "var(--border-color)", margin: "0.375rem 0" }} />
      {hasRunningNodes ? (
        <ToolBtn icon="stop" label="Stop All" onClick={stopAll} />
      ) : (
        <ToolBtn icon="play_arrow" label="Run All" onClick={() => runAll()} disabled={nodes.length === 0} />
      )}
      <ToolBtn icon="undo" label="Undo (⌘Z)" onClick={undo} disabled={!canUndo} />
      <ToolBtn icon="redo" label="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo} />
      <div style={{ width: "24px", height: "1px", background: "var(--border-color)", margin: "0.375rem 0" }} />
      <ThemeToggle />
    </div>
  )
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  return <ToolBtn icon={theme === "dark" ? "light_mode" : "dark_mode"} label={theme === "dark" ? "Light Mode" : "Dark Mode"} onClick={toggleTheme} />
}

function ToolBtn({ icon, label, onClick, disabled, active, accent }: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        width: "36px", height: "36px", borderRadius: "0.375rem",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", background: active && !accent ? "#f5f3ff" : "transparent", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, color: active || accent ? "#5965AF" : "var(--text-secondary)",
        transition: "background-color 150ms ease",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = active && !accent ? "#f5f3ff" : "var(--bg-hover)" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active && !accent ? "#f5f3ff" : "transparent" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{icon}</span>
    </button>
  )
}
