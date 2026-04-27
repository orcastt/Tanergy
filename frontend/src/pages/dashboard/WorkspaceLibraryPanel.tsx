import { useEffect, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { useLibraryStore } from "../../store/libraryStore"
import type { LibraryItem, LibraryKind } from "../../types/library"
import { resolveLocalImageSrc } from "../../nodes/image/localImageHtml"
import { setLibraryDragData } from "../../library/libraryDrag"
import LibraryKnowledgeGraph from "./LibraryKnowledgeGraph"

type ViewMode = "gallery" | "list" | "graph"

const KIND_TABS: Array<{ id: LibraryKind; labelKey: string; icon: string }> = [
  { id: "image", labelKey: "workspaceLibrary.images", icon: "image" },
  { id: "text", labelKey: "workspaceLibrary.documents", icon: "article" },
]

export default function WorkspaceLibraryPanel() {
  const { t } = useTranslation()
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("workspaceLibrary.searchPlaceholder")} style={inputStyle} />
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} style={inputStyle}>
            <option value="">{t("workspaceLibrary.allTags")}</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </div>
        <TagCloud tags={tags} selectedTag={selectedTag} onSelect={setSelectedTag} />
      </div>

      {viewMode === "graph" && (
        <LibraryKnowledgeGraph query={query} selectedTag={selectedTag} onSelectTag={setSelectedTag} onSelectKind={setKind} />
      )}
      {viewMode !== "graph" && loading && <LibraryEmpty icon="hourglass_top" text={t("workspaceLibrary.loading")} />}
      {viewMode !== "graph" && error && <LibraryEmpty icon="error" text={error} tone="error" />}
      {viewMode !== "graph" && !loading && !error && items.length === 0 && (
        <LibraryEmpty icon={kind === "image" ? "image" : "article"} text={t("workspaceLibrary.empty")} />
      )}
      {viewMode !== "graph" && !loading && !error && items.length > 0 && (
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
  const { t } = useTranslation()
  return (
    <div style={{ display: "flex", gap: "0.375rem" }}>
      {KIND_TABS.map((tab) => <PillButton key={tab.id} active={value === tab.id} icon={tab.icon} label={t(tab.labelKey)} onClick={() => onChange(tab.id)} />)}
    </div>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: "flex", gap: "0.375rem" }}>
      <PillButton active={value === "gallery"} icon="grid_view" label={t("workspaceLibrary.gallery")} onClick={() => onChange("gallery")} />
      <PillButton active={value === "list"} icon="view_list" label={t("workspaceLibrary.list")} onClick={() => onChange("list")} />
      <PillButton active={value === "graph"} icon="hub" label={t("workspaceLibrary.graph")} onClick={() => onChange("graph")} />
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
  const { t, i18n } = useTranslation()
  const imageSrc = item.kind === "image" ? resolveLocalImageSrc(item.file_path) : ""
  const summary = getSummary(item)
  return (
    <article draggable onDragStart={(event) => setLibraryDragData(event, item)} style={cardStyle}>
      <Preview item={item} imageSrc={imageSrc} summary={summary} compact={false} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={titleStyle}>{item.title}</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {t("workspaceLibrary.updated", { time: getLocalizedTimeAgo(new Date(item.updated_at), i18n.language) })}
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
  const { t, i18n } = useTranslation()
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
        <p style={summaryStyle}>{summary || t("workspaceLibrary.noPreview")}</p>
        <TagList tags={item.tags} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {getLocalizedTimeAgo(new Date(item.updated_at), i18n.language)}
        </span>
        <DeleteButton onClick={() => onDelete(item.id)} />
      </div>
    </article>
  )
}

function Preview({ item, imageSrc, summary, compact }: { item: LibraryItem; imageSrc: string; summary: string; compact: boolean }) {
  const { t } = useTranslation()
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
        {summary || t("workspaceLibrary.documentAsset")}
      </p>
    </div>
  )
}

function PreviewIcon({ icon }: { icon: string }) {
  return <div style={{ height: "100%", display: "grid", placeItems: "center" }}><span className="material-symbols-outlined" style={{ fontSize: 30, color: "var(--text-placeholder)" }}>{icon}</span></div>
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} title={t("workspaceLibrary.deleteAsset")} style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", padding: "0.25rem" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
    </button>
  )
}

function TagCloud({ tags, selectedTag, onSelect }: { tags: string[]; selectedTag: string; onSelect: (tag: string) => void }) {
  const { t } = useTranslation()
  if (tags.length === 0) return null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.875rem" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--text-secondary)" }}>{t("workspaceLibrary.tagCloud")}</span>
      {tags.slice(0, 16).map((tag) => (
        <button key={tag} onClick={() => onSelect(selectedTag === tag ? "" : tag)} style={{ ...tagButtonStyle, ...(selectedTag === tag ? activeTagButtonStyle : null) }}>
          #{tag}
        </button>
      ))}
    </div>
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

function getLocalizedTimeAgo(date: Date, language: string) {
  const locale = language.startsWith("zh") ? "zh-CN" : "en-US"
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const diffMins = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMins < 60) return formatter.format(-diffMins, "minute")
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return formatter.format(-diffHours, "hour")
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return formatter.format(-diffDays, "day")
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" })
}

const panelStyle: CSSProperties = { background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const inputStyle: CSSProperties = { width: "100%", border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "0.625rem 0.75rem", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }
const cardStyle: CSSProperties = { minHeight: "18rem", background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem", cursor: "grab", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const rowStyle: CSSProperties = { background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "0.875rem", display: "flex", alignItems: "center", gap: "0.875rem", cursor: "grab", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const previewStyle: CSSProperties = { borderRadius: "0.5rem", overflow: "hidden", background: "linear-gradient(135deg, rgba(99,73,234,0.08), rgba(34,197,94,0.05))", flexShrink: 0 }
const titleStyle: CSSProperties = { fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
const summaryStyle: CSSProperties = { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-secondary)", overflow: "hidden" }
const tagStyle: CSSProperties = { fontSize: "0.625rem", color: "#5965AF", background: "#f5f3ff", borderRadius: 999, padding: "0.125rem 0.375rem", fontWeight: 700 }
const tagButtonStyle: CSSProperties = { border: "none", borderRadius: 999, padding: "0.25rem 0.5rem", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 700 }
const activeTagButtonStyle: CSSProperties = { background: "#242424", color: "#fff" }
