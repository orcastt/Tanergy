import { useTranslation } from "react-i18next"
import { useLayerStore } from "./layerStore"
import { resolveLocalImageSrc } from "./localImageHtml"
import { imageCache } from "./imageCache"
import { editorColors, editorShadows, editorTypography } from "../../styles/editorDesign"

interface ImageItem {
  id: string
  file_path: string
  description: string
  prompt: string
  position: string
}

interface Props {
  images: ImageItem[]
}

function SourceThumb({ img, index }: { img: ImageItem; index: number }) {
  const { t } = useTranslation()
  const src = imageCache.get(img.id) ?? resolveLocalImageSrc(img.file_path)
  const { addImageLayer } = useLayerStore()
  if (src) imageCache.set(img.id, src)

  // Click to add directly to canvas
  function handleClick() {
    if (!src) return
    addImageLayer(src, img.description || t("image_editor.source.fallback", { index: index + 1 }))
  }

  // Drag — transfer only the cache key, not the full base64
  function handleDragStart(e: React.DragEvent) {
    if (!src) { e.preventDefault(); return }
    e.dataTransfer.setData("text/image-id", img.id)
    e.dataTransfer.effectAllowed = "copy"
  }

  if (!src) {
    return (
      <div style={{
        width: "100%", aspectRatio: "4/3", background: "var(--bg-hover)",
        borderRadius: "0.25rem", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "0.625rem", color: "var(--text-secondary)",
      }}>{t("image_editor.source.loading")}</div>
    )
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      style={{ cursor: "pointer", position: "relative" }}
      title={t("image_editor.source.thumbTitle")}
    >
      <img
        src={src}
        alt={img.description}
        draggable={false}
        style={{
          width: "100%", borderRadius: "0.25rem", objectFit: "contain",
          background: "#f0f0f0", display: "block", pointerEvents: "none",
        }}
      />
      <div style={{
        position: "absolute", bottom: "4px", right: "4px",
        background: editorColors.primary, color: "#fff", borderRadius: "0.25rem",
        padding: "1px 4px", fontSize: "9px", lineHeight: 1.2,
      }}>+ {t("image_editor.source.add")}</div>
      <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "0.125rem", padding: "0 0.125rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {img.description || t("image_editor.source.fallback", { index: index + 1 })}
      </div>
    </div>
  )
}

export default function SourcePanel({ images }: Props) {
  const { t } = useTranslation()
  return (
    <div style={{
      width: "180px", boxShadow: editorShadows.insetRight, flexShrink: 0,
      background: editorColors.canvas, display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "0.5rem 0.75rem", boxShadow: editorShadows.insetBottom,
        ...editorTypography.label, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: "0.375rem",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>photo_library</span>
        {t("image_editor.source.title", { count: images.length })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {images.length === 0 ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-placeholder)", fontSize: "0.75rem" }}>
            {t("image_editor.source.empty").split("\n").map((line) => <span key={line}>{line}<br /></span>)}
          </div>
        ) : (
          images.map((img, i) => <SourceThumb key={img.id} img={img} index={i} />)
        )}
      </div>
      <div style={{
        padding: "0.375rem 0.5rem", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.05)",
        fontSize: "0.5625rem", color: "var(--text-placeholder)", textAlign: "center",
      }}>
        {t("image_editor.source.footer")}
      </div>
    </div>
  )
}
