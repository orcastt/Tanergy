import { useState, useRef, useEffect } from "react"
import type { Workflow } from "../types/workflow"

interface Props {
  workflow: Workflow
  onClick: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}

export default function WorkflowCard({ workflow, onClick, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workflow.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="card cursor-pointer group" onClick={() => { if (!editing) onClick() }}>
      {/* Thumbnail */}
      <div className="w-full flex items-center justify-center rounded-t-2xl" style={{ height: "160px", background: "linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)" }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.5">
          <rect x="6" y="12" width="16" height="12" rx="3" fill="#DDD6FE" />
          <rect x="26" y="24" width="16" height="12" rx="3" fill="#BFDBFE" />
          <line x1="22" y1="18" x2="26" y2="30" stroke="#C4B5FD" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="22" cy="18" r="3" fill="#8B5CF6" opacity="0.6" />
          <circle cx="26" cy="30" r="3" fill="#3B82F6" opacity="0.6" />
        </svg>
      </div>

      {/* Info */}
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between">
          {editing ? (
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename} onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setEditing(false) }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium rounded-lg px-2 py-1 w-full" style={{ color: "#1a1a2e", background: "#f4f4f5", border: "1.5px solid #6366F1" }} />
          ) : (
            <p className="text-sm font-semibold truncate flex-1" style={{ color: "#1a1a2e" }}>{workflow.name}</p>
          )}

          <div ref={menuRef} className="relative">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="ml-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none" style={{ color: "#a1a1aa" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white py-1.5 z-10 min-w-[130px] rounded-xl shadow-soft-md" style={{ border: "1px solid #f4f4f5" }}>
                <button onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm bg-transparent border-none cursor-pointer" style={{ color: "#3f3f46" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f4f4f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  Rename
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(workflow.id, workflow.name); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm bg-transparent border-none cursor-pointer" style={{ color: "#DC2626" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#FEF2F2"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "#a1a1aa" }}>Updated {dateStr}</p>
      </div>
    </div>
  )
}
