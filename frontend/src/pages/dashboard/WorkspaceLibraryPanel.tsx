import { useEffect, useState, type CSSProperties } from "react"
import { useLibraryStore } from "../../store/libraryStore"
import type { LibraryItem, LibraryKind } from "../../types/library"
import { resolveLocalImageSrc } from "../../nodes/image/localImageHtml"
import { setLibraryDragData } from "../../library/libraryDrag"
import { getTimeAgo } from "./WorkflowCards"

type ViewMode = "gallery" | "list"

const KIND_TABS: Array<{ id: LibraryKind; label: string; icon: string }> = [
  { id: "image", label: "图片", icon: "image" },
  { id: "text", label: "文档", icon: "article" },
]

export default function WorkspaceLibraryPanel() {
  const { kind, query, selectedTag, items, tags, loading, error, setKind, setQuery, setSelectedTag, refresh, deleteItem } = useLibraryStore()
  const [viewMode, setViewMode] = useState<ViewMode>("gallery")

  useEffect(() => { void refresh() }, [refresh])

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <KindTabs value={kind} onChange={setKind} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 180px", gap: "0.75rem", marginTop: "1rem" }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、正文或标签" style={inputStyle} />
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} style={inputStyle}>
            <option value="">全部标签</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </div>
      </div>

      {loading && <LibraryEmpty icon="hourglass_top" text="加载素材中..." />}
      {error && <LibraryEmpty icon="error" text={error} tone="error" />}
      {!loading && !error && items.length === 0 && (
        <LibraryEmpty icon={kind === "image" ? "image" : "article"} text="还没有素材，先从节点保存一个吧" />
      )}
      {!loading && !error && items.length > 0 && (
        viewMode === "gallery" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            {items.map((item) => <LibraryGalleryCard key={item.id} item={item} onDelete={(id) => void deleteItem(id)} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {items.map((item) => <LibraryListRow key={item.id} item={item} onDelete={(id) => void deleteItem(id)} />)}
          </div>
        )
      )}
    </section>
  )
}

function KindTabs({ value, onChange }: { value: LibraryKind; onChange: (value: LibraryKind) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.375rem" }}>
      {KIND_TABS.map((tab) => <PillButton key={tab.id} active={value === tab.id} icon={tab.icon} label={tab.label} onClick={() => onChange(tab.id)} />)}
    </div>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.375rem" }}>
      <PillButton active={value === "gallery"} icon="grid_view" label="Gallery" onClick={() => onChange("gallery")} />
      <PillButton active={value === "list"} icon="view_list" label="List" onClick={() => onChange("list")} />
    </div>
  )
}

function PillButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.75rem",
      borderRadius: "999px", border: "none", background: active ? "#242424" : "var(--bg-hover)",
      color: active ? "#ffffff" : "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  )
}

function LibraryGalleryCard({ item, onDelete }: { item: LibraryItem; onDelete: (id: string) => void }) {
  const imageSrc = item.kind === "image" ? resolveLocalImageSrc(item.file_path) : ""
  const summary = getSummary(item)
  return (
    <article draggable onDragStart={(event) => setLibraryDragData(event, item)} style={cardStyle}>
      <Preview item={item} imageSrc={imageSrc} summary={summary} compact={false} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={titleStyle}>{item.title}</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Updated {getTimeAgo(new Date(item.updated_at))}
          </p>
        </div>
        <DeleteButton onClick={() => onDelete(item.id)} />
      </div>
      {summary && <p style={summaryStyle}>{summary}</p>}
      <TagList tags={item.tags} />
    </article>
  )
}

function LibraryListRow({ item, onDelete }: { item: LibraryItem; onDelete: (id: string) => void }) {
  const imageSrc = item.kind === "image" ? resolveLocalImageSrc(item.file_path) : ""
  const summary = getSummary(item)
  return (
    <article draggable onDragStart={(event) => setLibraryDragData(event, item)} style={rowStyle}>
      <Preview item={item} imageSrc={imageSrc} summary={summary} compact />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17, color: item.kind === "image" ? "#22C55E" : "#3B82F6" }}>
            {item.kind === "image" ? "image" : "article"}
          </span>
          <h3 style={titleStyle}>{item.title}</h3>
        </div>
        <p style={summaryStyle}>{summary || "No preview content"}</p>
        <TagList tags={item.tags} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {getTimeAgo(new Date(item.updated_at))}
        </span>
        <DeleteButton onClick={() => onDelete(item.id)} />
      </div>
    </article>
  )
}

function Preview({ item, imageSrc, summary, compact }: { item: LibraryItem; imageSrc: string; summary: string; compact: boolean }) {
  if (item.kind === "image") {
    return (
      <div style={{ ...previewStyle, width: compact ? 88 : "100%", height: compact ? 66 : 144 }}>
        {imageSrc ? <img src={imageSrc} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <PreviewIcon icon="image" />}
      </div>
    )
  }
  return (
    <div style={{ ...previewStyle, width: compact ? 88 : "100%", height: compact ? 66 : 144, padding: compact ? "0.5rem" : "1rem" }}>
      <span className="material-symbols-outlined" style={{ fontSize: compact ? 18 : 24, color: "#3B82F6" }}>article</span>
      <p style={{ marginTop: "0.5rem", fontSize: compact ? "0.625rem" : "0.75rem", lineHeight: 1.5, color: "var(--text-secondary)", overflow: "hidden" }}>
        {summary || "Document asset"}
      </p>
    </div>
  )
}

function PreviewIcon({ icon }: { icon: string }) {
  return <div style={{ height: "100%", display: "grid", placeItems: "center" }}><span className="material-symbols-outlined" style={{ fontSize: 30, color: "var(--text-placeholder)" }}>{icon}</span></div>
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="删除素材" style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", padding: "0.25rem" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
    </button>
  )
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
      {tags.map((tag) => <span key={tag} style={tagStyle}>{tag}</span>)}
    </div>
  )
}

function LibraryEmpty({ icon, text, tone }: { icon: string; text: string; tone?: "error" }) {
  return (
    <div style={{ ...panelStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 260, gap: "0.75rem", color: tone === "error" ? "#EF4444" : "var(--text-secondary)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", color: tone === "error" ? "#EF4444" : "var(--text-placeholder)" }}>{icon}</span>
      <p style={{ fontSize: "0.875rem" }}>{text}</p>
    </div>
  )
}

function getSummary(item: LibraryItem) {
  return (item.plain_text ?? item.content_html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 150)
}

const panelStyle: CSSProperties = { background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const inputStyle: CSSProperties = { width: "100%", border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.625rem 0.75rem", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }
const cardStyle: CSSProperties = { minHeight: "18rem", background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem", cursor: "grab", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const rowStyle: CSSProperties = { background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "0.875rem", display: "flex", alignItems: "center", gap: "0.875rem", cursor: "grab", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const previewStyle: CSSProperties = { borderRadius: "0.5rem", overflow: "hidden", background: "linear-gradient(135deg, rgba(99,73,234,0.08), rgba(34,197,94,0.05))", flexShrink: 0 }
const titleStyle: CSSProperties = { fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
const summaryStyle: CSSProperties = { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-secondary)", overflow: "hidden" }
const tagStyle: CSSProperties = { fontSize: "0.625rem", color: "#5965AF", background: "#f5f3ff", borderRadius: 999, padding: "0.125rem 0.375rem", fontWeight: 700 }
