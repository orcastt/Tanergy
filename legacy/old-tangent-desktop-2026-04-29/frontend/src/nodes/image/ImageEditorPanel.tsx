import { useTranslation } from "react-i18next"
import ImageThumb from "./ImageThumb"
import { editorColors, editorTypography } from "../../styles/editorDesign"

interface ImageItem {
  id: string
  file_path: string
  description: string
  prompt: string
  position: string
}

interface Props {
  images: ImageItem[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export default function ImageEditorPanel({ images, selectedIndex, onSelect }: Props) {
  const { t } = useTranslation()
  if (images.length === 0) {
    return (
      <div style={{
        padding: "1rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.8125rem",
      }}>
        {t("image_editor.panel.empty")}
      </div>
    )
  }

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "0.5rem",
      display: "flex", flexDirection: "column", gap: "0.5rem",
    }}>
      <div style={{ ...editorTypography.label, color: editorColors.secondary, marginBottom: "0.25rem" }}>
        {t("image_editor.panel.images", { count: images.length })}
      </div>
      {images.map((img, i) => (
        <div key={img.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
          <ImageThumb filePath={img.file_path} description={img.description} selected={i === selectedIndex} />
          <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "0.125rem", padding: "0 0.125rem" }}>
            {img.description || t("image_editor.panel.fallback", { index: i + 1 })}
          </div>
        </div>
      ))}
    </div>
  )
}
