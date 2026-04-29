import { useState, useEffect, useRef } from "react"
import { tauri } from "../../services/tauri"
import type { Workflow } from "../../types/workflow"
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile } from "@tauri-apps/plugin-fs"
export const CARD_COLORS = ["#6349EA", "#22C55E", "#3B82F6", "#F59E0B", "#EF4444"]

export function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/* ── Trash Card ── */
export function TrashCard({ workflow, onRestore, onDelete }: {
  workflow: Workflow
  onRestore: () => void
  onDelete: () => void
}) {
  const colorIdx = Math.abs(hashCode(workflow.id)) % CARD_COLORS.length
  const color = CARD_COLORS[colorIdx]

  return (
    <div style={{
      background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem",
      height: "14rem", display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
      opacity: 0.75,
    }}>
      <div style={{
        width: "100%", height: "6rem", background: "var(--bg-hover)",
        borderRadius: "0.5rem", marginBottom: "1rem", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${color}10, transparent)` }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "2rem", color: "var(--text-placeholder)" }}>delete</span>
        </div>
      </div>
      <div>
        <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          {workflow.name}
        </h4>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.625rem" }}>
          <button
            onClick={onRestore}
            style={{
              flex: 1, padding: "0.375rem 0", fontSize: "0.75rem", fontWeight: 500,
              background: "var(--bg-hover)", border: "none", borderRadius: "0.25rem",
              color: "var(--text-primary)", cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--border-color)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
          >
            Restore
          </button>
          <button
            onClick={() => { if (confirm(`Permanently delete "${workflow.name}"?`)) onDelete() }}
            style={{
              flex: 1, padding: "0.375rem 0", fontSize: "0.75rem", fontWeight: 500,
              background: "#fff0f0", border: "none", borderRadius: "0.25rem",
              color: "#ba1a1a", cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#ffdad6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#fff0f0"}
          >
            Delete Forever
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Workflow Card ── */
export function WorkflowCardInline({ workflow, onClick, onRename, onCopy, onTrash }: {
  workflow: Workflow
  onClick: () => void
  onRename: (id: string, name: string) => void
  onCopy: () => void
  onTrash: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workflow.name)
  const [hovered, setHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorIdx = Math.abs(hashCode(workflow.id)) % CARD_COLORS.length
  const color = CARD_COLORS[colorIdx]

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [menuOpen])

  async function handleExport() {
    try {
      const json = await tauri.exportWorkflow(workflow.id)
      const filePath = await save({
        defaultPath: `${workflow.name}.tangent.json`,
        filters: [{ name: "Tangent Workflow", extensions: ["tangent.json"] }],
      })
      if (filePath) {
        await writeFile(filePath, new TextEncoder().encode(json))
      }
      setMenuOpen(false)
    } catch (e) {
      console.error("export failed", e)
    }
  }

  function finishRename() {
    const t = draft.trim()
    if (t && t !== workflow.name) onRename(workflow.id, t)
    setEditing(false)
  }

  const updated = new Date(workflow.updated_at)
  const timeAgo = getTimeAgo(updated)

  return (
    <div
      onClick={() => { if (!editing && !menuOpen) onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-surface)",
        borderRadius: "0.5rem",
        padding: "1.25rem",
        height: "14rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
        cursor: editing ? "default" : "pointer",
        transition: "background-color 200ms",
        position: "relative",
        backgroundColor: hovered ? "var(--bg-hover)" : "var(--bg-surface)",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%", height: "6rem", background: "var(--bg-hover)",
        borderRadius: "0.5rem", marginBottom: "1rem", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom right, ${color}10, transparent)` }} />
        <div style={{
          position: "absolute", top: "0.5rem", left: "0.5rem", width: "4rem", height: "2rem",
          background: "var(--bg-surface)", borderRadius: "0.25rem",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "8px", fontWeight: 600, color: "var(--text-primary)",
        }}>Input</div>
        <div style={{
          position: "absolute", top: "2rem", left: "2.5rem", width: "4rem", height: "2rem",
          background: "var(--bg-surface)", borderRadius: "0.25rem",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "8px", fontWeight: 600, color: "var(--text-primary)",
        }}>Process</div>
      </div>

      {/* Info */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") { setDraft(workflow.name); setEditing(false) } }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, padding: "0.25rem 0.5rem", fontSize: "0.875rem", fontWeight: 600,
                color: "var(--text-primary)", background: "var(--bg-hover)", borderRadius: "0.25rem",
                border: "1.5px solid #6349EA", outline: "none",
              }}
            />
          ) : (
            <h4
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 600, fontSize: "0.875rem",
                color: hovered ? color : "var(--text-primary)",
                transition: "color 200ms",
                flex: 1, marginRight: "0.25rem",
                userSelect: "none",
              }}
              title="Double-click to rename"
            >
              {workflow.name}
            </h4>
          )}

          {/* Three-dot menu */}
          <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              style={{
                padding: "0.25rem",
                opacity: hovered || menuOpen ? 1 : 0,
                background: menuOpen ? "var(--bg-hover)" : "transparent",
                border: "none", color: "var(--text-secondary)", cursor: "pointer",
                borderRadius: "0.25rem",
                transition: "opacity 200ms, background 150ms",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>more_vert</span>
            </button>

            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 4px)",
                background: "var(--bg-surface)",
                padding: "0.375rem 0", zIndex: 50, minWidth: "160px",
                borderRadius: "0.75rem",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
              }}>
                <MenuItem
                  icon="edit"
                  label="Rename"
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                />
                <MenuItem
                  icon="content_copy"
                  label="Make a copy"
                  onClick={(e) => { e.stopPropagation(); onCopy(); setMenuOpen(false) }}
                />
                <MenuItem
                  icon="upload"
                  label="Export JSON"
                  onClick={(e) => { e.stopPropagation(); handleExport() }}
                />
                <div style={{ height: "1px", background: "var(--border-color)", margin: "0.375rem 0" }} />
                <MenuItem
                  icon="delete"
                  label="Move to Trash"
                  danger
                  onClick={(e) => { e.stopPropagation(); onTrash(); setMenuOpen(false) }}
                />
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          Edited {timeAgo}
        </p>
      </div>
    </div>
  )
}

export function MenuItem({ icon, label, danger, onClick }: {
  icon: string
  label: string
  danger?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "0.625rem",
        padding: "0.5rem 1rem", fontSize: "0.8125rem",
        background: hov ? (danger ? "#fff0f0" : "var(--bg-hover)") : "transparent",
        border: "none", cursor: "pointer",
        color: danger ? "#ba1a1a" : "var(--text-primary)",
        textAlign: "left",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
      {label}
    </button>
  )
}

export function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} mins ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? "s" : ""} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
