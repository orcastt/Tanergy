import { useMemo, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { useLibraryStore } from "../store/libraryStore"
import type { CreateLibraryItemPayload, LibraryKind } from "../types/library"
import { editorColors, editorShadows, editorTypography, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../styles/editorDesign"

interface Props {
  kind: LibraryKind
  defaultTitle: string
  payload: Omit<CreateLibraryItemPayload, "kind" | "title" | "tags">
  onClose: () => void
  onSaved?: () => void
}

export default function LibrarySaveDialog({ kind, defaultTitle, payload, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const { tags, createItem } = useLibraryStore()
  const [title, setTitle] = useState(defaultTitle)
  const [tagText, setTagText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const tagPreview = useMemo(() => parseTags(tagText), [tagText])

  async function save() {
    if (!title.trim()) {
      setError(t("library.titleRequired"))
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
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: editorColors.primary }}>{kind === "text" ? "article" : "image"}</span>
          <div style={{ ...editorTypography.title, fontSize: 15 }}>{t("library.saveTitle")}</div>
        </div>
        <label style={labelStyle}>{t("common.title")}</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} autoFocus />
        <label style={labelStyle}>{t("common.tags")}</label>
        <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder={t("library.tagPlaceholder")} style={inputStyle} />
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {tags.slice(0, 8).map((tag) => (
              <button key={tag} onClick={() => setTagText((prev) => mergeTag(prev, tag))} style={chipStyle}>{tag}</button>
            ))}
          </div>
        )}
        {tagPreview.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>{t("library.willAdd", { tags: tagPreview.join(" / ") })}</div>
        )}
        {error && <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryButtonStyle}>{t("common.cancel")}</button>
          <button onClick={() => void save()} disabled={saving} style={primaryButtonStyle}>{saving ? t("common.saving") : t("common.save")}</button>
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
  position: "fixed", inset: 0, zIndex: 13000, background: "rgba(36,36,36,0.32)",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)",
}
const dialogStyle: CSSProperties = {
  width: 420, borderRadius: 12, background: "var(--bg-surface)", padding: 18,
  boxShadow: editorShadows.modal,
}
const labelStyle: CSSProperties = { ...editorTypography.label, display: "block", margin: "12px 0 6px", color: editorColors.secondary }
const chipStyle: CSSProperties = { border: "none", borderRadius: 999, background: editorColors.hover, color: editorColors.text, padding: "3px 8px", fontSize: 11, cursor: "pointer", boxShadow: editorShadows.ring }
