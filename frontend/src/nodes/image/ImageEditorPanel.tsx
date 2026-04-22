import ImageThumb from "./ImageThumb"

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
  if (images.length === 0) {
    return (
      <div style={{
        padding: "1rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.8125rem",
      }}>
        No images yet. Run the node to generate.
      </div>
    )
  }

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "0.5rem",
      display: "flex", flexDirection: "column", gap: "0.5rem",
    }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
        Images ({images.length})
      </div>
      {images.map((img, i) => (
        <div key={img.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
          <ImageThumb filePath={img.file_path} description={img.description} selected={i === selectedIndex} />
          <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "0.125rem", padding: "0 0.125rem" }}>
            {img.description || `Image ${i + 1}`}
          </div>
        </div>
      ))}
    </div>
  )
}
