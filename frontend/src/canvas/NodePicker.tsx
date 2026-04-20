import { useState, useEffect, useRef } from "react"
import { NODE_DEFS } from "../nodes/nodeDefs"
import type { NodeType } from "../types/node"

interface Props {
  open: boolean
  position: { x: number; y: number } | null
  onSelect: (type: NodeType, position?: { x: number; y: number }) => void
  onClose: () => void
}

type Category = "all" | "input" | "text" | "ai" | "image" | "output"

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "input", label: "Input" },
  { key: "text", label: "Text" },
  { key: "ai", label: "AI" },
  { key: "image", label: "Image" },
  { key: "output", label: "Output" },
]

export default function NodePicker({ open, position, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<Category>("all")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener("keydown", h)
    document.addEventListener("mousedown", click)
    return () => { document.removeEventListener("keydown", h); document.removeEventListener("mousedown", click) }
  }, [open, onClose])

  useEffect(() => { if (open) { setSearch(""); setCategory("all") } }, [open])

  if (!open) return null

  const filtered = NODE_DEFS.filter((d) => {
    if (category !== "all" && d.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: position ? position.x : "50%",
        top: position ? position.y : "50%",
        transform: position ? "translate(-50%, -50%)" : "translate(-50%, -50%)",
        width: "480px",
        maxHeight: "600px",
        background: "#ffffff",
        borderRadius: "0.75rem",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.12)",
        zIndex: 100,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Search */}
      <div style={{ padding: "1rem", borderBottom: "1px solid #efeded", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#747878" }}>search</span>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          style={{
            flex: 1, border: "none", outline: "none", fontSize: "0.875rem",
            color: "#0e0f0f", background: "transparent", fontFamily: '"Inter", sans-serif',
          }}
        />
        <span style={{ fontSize: "0.75rem", color: "#747878", background: "#f5f3f3", padding: "0.125rem 0.5rem", borderRadius: "0.25rem" }}>ESC</span>
      </div>

      {/* Categories */}
      <div style={{ padding: "0.5rem 1rem", display: "flex", gap: "0.375rem", borderBottom: "1px solid #efeded" }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none",
              fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
              background: category === c.key ? "#242424" : "#f5f3f3",
              color: category === c.key ? "#ffffff" : "#5e5e5e",
              transition: "all 150ms ease",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: "0.75rem", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem", color: "#747878", fontSize: "0.875rem" }}>
            No matching nodes found
          </div>
        )}
        {filtered.map((def) => (
          <button
            key={def.type}
            onClick={() => { onSelect(def.type, position || undefined); onClose() }}
            style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.75rem", borderRadius: "0.5rem", border: "none",
              background: "#ffffff", cursor: "pointer", textAlign: "left",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
              transition: "box-shadow 150ms ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)"}
          >
            <div style={{
              width: "2rem", height: "2rem", borderRadius: "0.375rem",
              background: "#f5f3f3", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>{def.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0e0f0f" }}>{def.label}</div>
              <div style={{ fontSize: "0.6875rem", color: "#747878", marginTop: "0.125rem" }}>{def.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
