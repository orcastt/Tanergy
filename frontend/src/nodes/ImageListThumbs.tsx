import { useState } from "react"
import { resolveLocalImageSrc } from "./image/localImageHtml"

export interface GeneratedImage {
  id: string
  plan_id: string
  file_path: string
  prompt: string
  description: string
  position: string
}

export function ImageThumb({ filePath, description, badge }: { filePath: string; description: string; badge?: number }) {
  const src = resolveLocalImageSrc(filePath)

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {src ? (
        <img src={src} alt={description} style={{ width: "100%", borderRadius: "0.25rem", objectFit: "cover", maxHeight: "80px" }} />
      ) : (
        <div style={{
          width: "100%", aspectRatio: "4/3", background: "var(--bg-hover)",
          borderRadius: "0.25rem", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "0.625rem", color: "var(--text-secondary)",
        }}>...</div>
      )}
      {badge != null && <ImageBadge value={badge} />}
    </div>
  )
}

export function InputThumb({ handleId, index, firstImg, canDelete, onDelete }: {
  handleId: string
  index: number
  firstImg: GeneratedImage | undefined
  canDelete: boolean
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {firstImg ? (
        <ImageThumb filePath={firstImg.file_path} description={firstImg.description} badge={index + 1} />
      ) : (
        <div style={{
          aspectRatio: "4/3", background: "var(--bg-hover)", borderRadius: "0.25rem",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "9px", color: "var(--text-secondary)", position: "relative",
        }}>
          图{index + 1}
          <ImageBadge value={index + 1} />
        </div>
      )}
      {canDelete && hovered && (
        <button
          onClick={(event) => { event.stopPropagation(); onDelete(handleId) }}
          style={{
            position: "absolute", top: 2, right: 2, width: "16px", height: "16px",
            background: "rgba(239,68,68,0.85)", color: "#fff", border: "none",
            borderRadius: "50%", fontSize: "12px", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}
        >−</button>
      )}
    </div>
  )
}

function ImageBadge({ value }: { value: number }) {
  return (
    <div style={{
      position: "absolute", top: 2, left: 2, minWidth: "14px", height: "14px",
      background: "#3B82F6", color: "#fff", borderRadius: "7px",
      fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "0 3px", lineHeight: 1,
    }}>{value}</div>
  )
}
