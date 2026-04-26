import { useMemo, useState, type CSSProperties } from "react"
import { useLibraryStore } from "../store/libraryStore"
import type { CreateLibraryItemPayload, LibraryKind } from "../types/library"

interface Props {
  kind: LibraryKind
  defaultTitle: string
  payload: Omit<CreateLibraryItemPayload, "kind" | "title" | "tags">
  onClose: () => void
  onSaved?: () => void
}

export default function LibrarySaveDialog({ kind, defaultTitle, payload, onClose, onSaved }: Props) {
  const { tags, createItem } = useLibraryStore()
  const [title, setTitle] = useState(defaultTitle)
  const [tagText, setTagText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const tagPreview = useMemo(() => parseTags(tagText), [tagText])

  async function save() {
    if (!title.trim()) {
      setError("请输入素材标题")
      return
    }
    setSaving(true)
    setError("")
    try {
      await createItem({ ...payload, kind, title: title.trim(), tags: tagPreview })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={backdropStyle} onMouseDown={(event) => event.stopPropagation()}>
      <div style={dialogStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#5965AF" }}>{kind === "text" ? "article" : "image"}</span>
          <div style={{ fontSize: 15, fontWeight: 800 }}>保存到素材库</div>
        </div>
        <label style={labelStyle}>标题</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} autoFocus />
        <label style={labelStyle}>标签</label>
        <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="用逗号分隔，例如：产品, 封面, 案例" style={inputStyle} />
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {tags.slice(0, 8).map((tag) => (
              <button key={tag} onClick={() => setTagText((prev) => mergeTag(prev, tag))} style={chipStyle}>{tag}</button>
            ))}
          </div>
        )}
        {tagPreview.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>将添加：{tagPreview.join(" / ")}</div>
        )}
        {error && <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryBtn}>取消</button>
          <button onClick={() => void save()} disabled={saving} style={primaryBtn}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  )
}

function parseTags(value: string) {
  return Array.from(new Set(value.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean)))
}

function mergeTag(value: string, tag: string) {
  return parseTags(`${value},${tag}`).join(", ")
}

const backdropStyle: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 13000, background: "rgba(0,0,0,0.28)",
  display: "flex", alignItems: "center", justifyContent: "center",
}
const dialogStyle: CSSProperties = {
  width: 420, borderRadius: 14, background: "var(--bg-surface)", padding: 18,
  boxShadow: "0 16px 48px rgba(0,0,0,0.24)", border: "1px solid var(--border-color)",
}
const labelStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, margin: "10px 0 6px" }
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--border-color)", borderRadius: 8, padding: "0.55rem 0.65rem", fontSize: 13 }
const chipStyle: CSSProperties = { border: "none", borderRadius: 999, background: "#f5f3ff", color: "#5965AF", padding: "3px 8px", fontSize: 11, cursor: "pointer" }
const secondaryBtn: CSSProperties = { border: "1px solid var(--border-color)", borderRadius: 8, background: "transparent", padding: "0.45rem 0.85rem", cursor: "pointer" }
const primaryBtn: CSSProperties = { border: "none", borderRadius: 8, background: "#5965AF", color: "#fff", padding: "0.45rem 0.85rem", cursor: "pointer", fontWeight: 700 }
