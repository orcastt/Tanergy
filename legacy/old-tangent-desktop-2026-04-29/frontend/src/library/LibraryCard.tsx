import type { LibraryItem } from "../types/library"
import { resolveLocalImageSrc } from "../nodes/image/localImageHtml"
import { setLibraryDragData } from "./libraryDrag"

interface Props {
  item: LibraryItem
  onDelete: (id: string) => void
}

export default function LibraryCard({ item, onDelete }: Props) {
  const imageSrc = item.kind === "image" ? resolveLocalImageSrc(item.file_path) : ""
  const summary = (item.plain_text ?? item.content_html ?? "").replace(/<[^>]*>/g, "").slice(0, 120)

  return (
    <div
      draggable
      onDragStart={(event) => setLibraryDragData(event, item)}
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: 10,
        background: "var(--bg-surface)",
        padding: "0.625rem",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {item.kind === "image" && (
        <div style={{ aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden", background: "var(--bg-hover)" }}>
          {imageSrc ? (
            <img src={imageSrc} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-secondary)", fontSize: 12 }}>No image</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: item.kind === "text" ? "#3B82F6" : "#22C55E" }}>
          {item.kind === "text" ? "article" : "image"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          {summary && (
            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: "var(--text-secondary)" }}>
              {summary}
            </div>
          )}
        </div>
        <button
          onClick={(event) => { event.stopPropagation(); onDelete(item.id) }}
          title="删除素材"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", padding: 2 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
        </button>
      </div>
      {item.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {item.tags.map((tag) => (
            <span key={tag} style={{ fontSize: 10, color: "#5965AF", background: "#f5f3ff", borderRadius: 999, padding: "2px 6px" }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
