import { useEffect, type CSSProperties } from "react"
import { useLibraryStore } from "../store/libraryStore"
import type { LibraryKind } from "../types/library"
import LibraryCard from "./LibraryCard"

const TABS: Array<{ id: LibraryKind; label: string; icon: string }> = [
  { id: "text", label: "文章组", icon: "article" },
  { id: "image", label: "图片组", icon: "image" },
]

export default function LibraryDrawer() {
  const { open, kind, query, selectedTag, items, tags, loading, error, setOpen, setKind, setQuery, setSelectedTag, refresh, deleteItem } = useLibraryStore()

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        title="个人素材库"
        style={{
          position: "absolute",
          left: open ? 332 : 16,
          top: 78,
          zIndex: 90,
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid var(--border-color)",
          background: "var(--bg-surface)",
          color: "#5965AF",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{open ? "chevron_left" : "folder_open"}</span>
      </button>

      {open && (
        <aside
          style={{
            position: "absolute",
            left: 16,
            top: 70,
            bottom: 16,
            zIndex: 80,
            width: 300,
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(12px)",
          }}
        >
          <Header onClose={() => setOpen(false)} />
          <Tabs value={kind} onChange={setKind} />
          <div style={{ padding: "0.625rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题或内容"
              style={inputStyle}
            />
            <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} style={inputStyle}>
              <option value="">全部标签</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 0.625rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {loading && <Empty text="加载素材中..." />}
            {error && <Empty text={error} tone="error" />}
            {!loading && !error && items.length === 0 && <Empty text="还没有素材，先从节点保存一个吧" />}
            {!loading && !error && items.map((item) => (
              <LibraryCard key={item.id} item={item} onDelete={(id) => void deleteItem(id)} />
            ))}
          </div>
        </aside>
      )}
    </>
  )
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--border-color)",
  borderRadius: 8,
  padding: "0.5rem 0.625rem",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  fontSize: 12,
  outline: "none",
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ padding: "0.75rem 0.875rem", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#5965AF" }}>folder_open</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>个人素材库</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>全局工作空间素材</div>
      </div>
      <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  )
}

function Tabs({ value, onChange }: { value: LibraryKind; onChange: (value: LibraryKind) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0.625rem 0.625rem 0" }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "0.5rem",
            borderRadius: 8,
            border: "none",
            background: value === tab.id ? "#f5f3ff" : "var(--bg-hover)",
            color: value === tab.id ? "#5965AF" : "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function Empty({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div style={{ padding: "1.5rem 0.75rem", textAlign: "center", color: tone === "error" ? "#EF4444" : "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
      {text}
    </div>
  )
}
