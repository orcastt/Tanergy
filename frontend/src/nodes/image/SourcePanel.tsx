import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useLayerStore } from "./layerStore"

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

// Module-level cache: id → base64 data URL
const imageCache = new Map<string, string>()

function SourceThumb({ img, index }: { img: ImageItem; index: number }) {
  const [src, setSrc] = useState<string | null>(() => imageCache.get(img.id) ?? null)
  const { addImageLayer } = useLayerStore()

  useEffect(() => {
    if (src) return
    let cancelled = false
    invoke<number[]>("read_asset_file", { filePath: img.file_path })
      .then((bytes) => {
        if (cancelled) return
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        const dataUrl = `data:image/png;base64,${base64}`
        imageCache.set(img.id, dataUrl)
        setSrc(dataUrl)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [img.file_path, img.id, src])

  // Click to add directly to canvas
  function handleClick() {
    if (!src) return
    addImageLayer(src, img.description || `图片 ${index + 1}`)
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
      }}>...</div>
    )
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      style={{ cursor: "pointer", position: "relative" }}
      title="点击添加到画板 / 拖拽到画板"
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
        background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: "0.25rem",
        padding: "1px 4px", fontSize: "9px", lineHeight: 1.2,
      }}>+ 添加</div>
      <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "0.125rem", padding: "0 0.125rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {img.description || `Image ${index + 1}`}
      </div>
    </div>
  )
}

export { imageCache }

export default function SourcePanel({ images }: Props) {
  return (
    <div style={{
      width: "180px", borderRight: "1px solid var(--border-color)", flexShrink: 0,
      background: "var(--bg-canvas)", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border-color)",
        fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: "0.375rem",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>photo_library</span>
        源图片 ({images.length})
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {images.length === 0 ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-placeholder)", fontSize: "0.75rem" }}>
            暂无图片<br />运行节点后生成
          </div>
        ) : (
          images.map((img, i) => <SourceThumb key={img.id} img={img} index={i} />)
        )}
      </div>
      <div style={{
        padding: "0.375rem 0.5rem", borderTop: "1px solid var(--border-color)",
        fontSize: "0.5625rem", color: "var(--text-placeholder)", textAlign: "center",
      }}>
        点击图片添加到画板
      </div>
    </div>
  )
}
