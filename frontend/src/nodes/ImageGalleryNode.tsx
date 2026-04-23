import { useState, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
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
  const { t } = useTranslation()
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
          {t("common.loading")}
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
        {description || t("nodes.image_gallery.image")}
      </div>
    </div>
  )
}

export default function ImageGalleryNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { t } = useTranslation()
  const { nodeStatuses, nodeResults } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { images?: GalleryImage[] } | undefined

  // Collect images from connected upstream nodes
  const images: GalleryImage[] = result?.images ?? []

  function openLightbox(img: GalleryImage) {
    useOverlayStore.getState().openLightbox({
      filePath: img.file_path,
      description: img.description,
      prompt: img.prompt,
      position: img.position,
    })
  }

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
          {t("nodes.image_gallery.connectHint")}
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.375rem" }}>
          {images.map((img) => (
            <GalleryThumb
              key={img.id}
              filePath={img.file_path}
              description={img.description}
              onClick={() => openLightbox(img)}
            />
          ))}
        </div>
      )}
    </NodeBase>
  )
}
