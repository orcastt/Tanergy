import { useState, useRef, useEffect } from "react"
import type { Workflow } from "../types/workflow"

interface Props {
  workflow: Workflow
  onClick: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}

const THUMB_COLORS = [
  { from: "#6349EA", label: "A" },
  { from: "#22C55E", label: "B" },
  { from: "#3B82F6", label: "C" },
]

export default function WorkflowCard({ workflow, onClick, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workflow.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const colorIdx = Math.abs(hashCode(workflow.id)) % THUMB_COLORS.length

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [menuOpen])

  function finishRename() {
    const t = draft.trim()
    if (t && t !== workflow.name) onRename(workflow.id, t)
    setEditing(false)
  }

  const updated = new Date(workflow.updated_at)
  const dateStr = updated.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  const thumbColor = THUMB_COLORS[colorIdx]

  return (
    <div
      className="group cursor-pointer"
      onClick={() => { if (!editing) onClick() }}
      style={{
        background: "#ffffff",
        borderRadius: "0.5rem",
        padding: "1.25rem",
        height: "14rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
        transition: "background-color 200ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#faf9f9" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff" }}
    >
      {/* Thumbnail */}
      <div className="w-full overflow-hidden relative rounded-lg mb-4" style={{ height: "6rem", background: "#f5f3f3" }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, ${thumbColor.from}10, transparent)` }} />
        <div className="absolute top-2 left-2 w-16 h-8 bg-white rounded flex items-center justify-center ring-shadow" style={{ fontSize: "8px", color: "#0e0f0f", fontWeight: 600 }}>Input</div>
        <div className="absolute top-8 left-10 w-16 h-8 bg-white rounded flex items-center justify-center ring-shadow" style={{ fontSize: "8px", color: "#0e0f0f", fontWeight: 600 }}>Process</div>
      </div>

      {/* Info */}
      <div className="relative">
        <div className="flex items-start justify-between">
          {editing ? (
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename} onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setEditing(false) }}
              onClick={(e) => e.stopPropagation()}
              className="w-full py-1 px-2 text-sm font-semibold outline-none" style={{ color: "#0e0f0f", background: "#f5f3f3", borderRadius: "0.125rem" }} />
          ) : (
            <h4 className="font-headline font-semibold text-sm transition-colors group-hover:text-[#6349EA]" style={{ color: "#0e0f0f" }}>
              {workflow.name}
            </h4>
          )}

          <div ref={menuRef} className="relative">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none" style={{ color: "#747878" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>more_vert</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 bg-white py-1.5 z-10 min-w-[130px] rounded-xl" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                <button onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm bg-transparent border-none cursor-pointer" style={{ color: "#0e0f0f" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5f3f3"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  Rename
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(workflow.id, workflow.name); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm bg-transparent border-none cursor-pointer" style={{ color: "#ba1a1a" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#ffdad6"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs mt-1 font-body" style={{ color: "#444748" }}>Edited {dateStr}</p>
      </div>
    </div>
  )
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
