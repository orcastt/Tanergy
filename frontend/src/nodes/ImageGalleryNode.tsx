import { useState, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { invoke } from "@tauri-apps/api/core"

interface GalleryImage {
  id: string
  plan_id: string
  file_path: string
  prompt: string
  description: string
  position: string
}

function GalleryThumb({ filePath, description, onClick }: {
  filePath: string; description: string; onClick: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    invoke<number[]>("read_asset_file", { filePath })
      .then((bytes) => {
        if (cancelled) return
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        setSrc(`data:image/png;base64,${base64}`)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [filePath])

  return (
    <div
      onClick={onClick}
      style={{ cursor: "pointer", width: "100%" }}
    >
      {!src ? (
        <div style={{
          width: "100%", aspectRatio: "4/3", background: "#f3f4f6",
          borderRadius: "0.375rem", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "0.625rem", color: "#9ca3af",
        }}>
          加载中...
        </div>
      ) : (
        <img
          src={src}
          alt={description}
          style={{
            width: "100%", borderRadius: "0.375rem", objectFit: "cover",
            maxHeight: "100px",
          }}
        />
      )}
      <div style={{
        fontSize: "0.5625rem", color: "#6b7280", marginTop: "0.125rem",
        textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {description || "图片"}
      </div>
    </div>
  )
}

function Lightbox({ images, index, onClose }: {
  images: GalleryImage[]; index: number; onClose: () => void
}) {
  const [current, setCurrent] = useState(index)
  const [src, setSrc] = useState<string | null>(null)
  const img = images[current]

  useEffect(() => {
    let cancelled = false
    invoke<number[]>("read_asset_file", { filePath: img.file_path })
      .then((bytes) => {
        if (cancelled) return
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        setSrc(`data:image/png;base64,${base64}`)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [img.file_path])

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: "2rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "0.75rem", padding: "1rem",
        maxWidth: "90vw", maxHeight: "90vh", display: "flex",
        flexDirection: "column", gap: "0.75rem",
      }}>
        {src ? (
          <img src={src} alt={img.description} style={{
            maxWidth: "100%", maxHeight: "60vh", objectFit: "contain",
            borderRadius: "0.375rem",
          }} />
        ) : (
          <div style={{ padding: "2rem", color: "#9ca3af", textAlign: "center" }}>加载中...</div>
        )}
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          {img.description} — {img.position}
        </div>
        {img.prompt && (
          <div style={{ fontSize: "0.6875rem", color: "#9ca3af", maxHeight: "40px", overflow: "auto" }}>
            {img.prompt}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <button
            disabled={current === 0}
            onClick={() => setCurrent(current - 1)}
            style={{
              padding: "0.25rem 0.75rem", fontSize: "0.75rem", borderRadius: "0.25rem",
              border: "1px solid #e3e2e2", cursor: current === 0 ? "default" : "pointer",
              opacity: current === 0 ? 0.4 : 1,
            }}
          >
            上一张
          </button>
          <span style={{ fontSize: "0.75rem", color: "#747878", lineHeight: "1.75" }}>
            {current + 1} / {images.length}
          </span>
          <button
            disabled={current === images.length - 1}
            onClick={() => setCurrent(current + 1)}
            style={{
              padding: "0.25rem 0.75rem", fontSize: "0.75rem", borderRadius: "0.25rem",
              border: "1px solid #e3e2e2", cursor: current === images.length - 1 ? "default" : "pointer",
              opacity: current === images.length - 1 ? 0.4 : 1,
            }}
          >
            下一张
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ImageGalleryNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { images?: GalleryImage[] } | undefined

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Collect images from connected upstream nodes
  const images: GalleryImage[] = result?.images ?? []

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>photo_library</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      {images.length === 0 && status !== "running" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          连接图片节点展示图片
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.375rem" }}>
          {images.map((img, i) => (
            <GalleryThumb
              key={img.id}
              filePath={img.file_path}
              description={img.description}
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </NodeBase>
  )
}
