import { useState, useRef, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import { useCanvasStore } from "../store/canvasStore"

const GROUP_COLORS = ["#6349EA", "#3B82F6", "#22C55E", "#EAB308", "#EF4444", "#EC4899", "#14B8A6", "#8B5CF6"]

export default function GroupNode({ id, data }: NodeProps) {
  const label = (data.label as string) || "Group"
  const color = (data.color as string) || "#6349EA"
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  useEffect(() => {
    if (!pickerOpen) return
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest(".color-picker-panel")) setPickerOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [pickerOpen])

  function finishEdit() {
    const t = draft.trim()
    if (t && t !== label) useCanvasStore.getState().updateNodeData(id, { label: t })
    setEditing(false)
  }

  function pickColor(c: string) {
    useCanvasStore.getState().updateNodeData(id, { color: c })
    setPickerOpen(false)
  }

  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: "0.5rem",
      background: `${color}08`, border: `2px dashed ${color}40`,
      position: "relative", overflow: "visible",
    }}>
      <div style={{
        position: "absolute", top: "-28px", left: 0, display: "flex",
        alignItems: "center", gap: "0.375rem", height: "28px",
      }}>
        <div style={{ position: "relative" }} className="color-picker-panel">
          <button
            onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen) }}
            style={{
              width: "14px", height: "14px", borderRadius: "50%", background: color,
              border: "2px solid var(--bg-surface)", cursor: "pointer", padding: 0,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
            }}
          />
          {pickerOpen && (
            <div style={{
              position: "absolute", top: "20px", left: "-4px", display: "flex",
              gap: "4px", background: "var(--bg-surface)", padding: "6px",
              borderRadius: "0.375rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 100, flexWrap: "wrap", width: "80px",
            }}>
              {GROUP_COLORS.map((c) => (
                <button key={c} onClick={() => pickColor(c)} style={{
                  width: "16px", height: "16px", borderRadius: "50%", background: c,
                  border: c === color ? "2px solid var(--text-primary)" : "2px solid transparent",
                  cursor: "pointer", padding: 0,
                }} />
              ))}
            </div>
          )}
        </div>

        {editing ? (
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => { if (e.key === "Enter") finishEdit(); if (e.key === "Escape") { setDraft(label); setEditing(false) } }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)",
              background: "var(--bg-hover)", border: "1px solid var(--border-color)",
              borderRadius: "0.25rem", padding: "0.125rem 0.375rem", outline: "none",
              fontFamily: '"Inter", sans-serif', width: "80px",
            }}
          />
        ) : (
          <span onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(label) }}
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", cursor: "default", userSelect: "none" }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
