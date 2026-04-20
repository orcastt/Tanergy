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

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  function finishRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== workflow.name) onRename(workflow.id, trimmed)
    setEditing(false)
  }

  const updated = new Date(workflow.updated_at)
  const dateStr = updated.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })

  return (
    <div
      className="group bg-white cursor-pointer relative"
      style={{
        borderRadius: "8px",
        boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px",
        transition: "box-shadow 150ms, transform 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.08) 0px 6px 12px"
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px"
        e.currentTarget.style.transform = "translateY(0)"
      }}
      onClick={() => { if (!editing) onClick() }}
    >
      <div
        className="w-full flex items-center justify-center"
        style={{ height: "160px", background: "#f5f5f5", borderRadius: "8px 8px 0 0" }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="14" height="10" rx="2" fill="#e5e5e5" /><rect x="22" y="18" width="14" height="10" rx="2" fill="#e5e5e5" /><line x1="18" y1="13" x2="22" y2="23" stroke="#d4d4d4" strokeWidth="1.5" strokeDasharray="2 2" /></svg>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-start justify-between">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setEditing(false) }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-[#242424] bg-[#f5f5f5] px-2 py-1 outline-none w-full"
              style={{ borderRadius: "4px" }}
            />
          ) : (
            <p className="text-sm font-medium text-[#242424] truncate flex-1">{workflow.name}</p>
          )}

          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer text-[#898989] hover:text-[#242424]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" /></svg>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-8 bg-white py-1 z-10 min-w-[120px]"
                style={{ borderRadius: "6px", boxShadow: "rgba(34,42,53,0.10) 0px 0px 0px 1px, rgba(34,42,53,0.08) 0px 8px 24px" }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#242424] hover:bg-[#f5f5f5] bg-transparent border-none cursor-pointer"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(workflow.id, workflow.name); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#EF4444] hover:bg-[#f5f5f5] bg-transparent border-none cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs mt-1" style={{ color: "#898989" }}>Updated {dateStr}</p>
      </div>
    </div>
  )
}
