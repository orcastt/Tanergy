import { useCallback, useEffect, useRef, useState } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
import { nodeResize } from "../lib/nodeEvents"
import { resolveLocalImageSrc } from "./image/localImageHtml"

interface ImageAssetData {
  nodeType: string
  title?: string
  filePath?: string
  description?: string
  libraryItemId?: string
  width?: number
  height?: number
}

const MIN_W = 220
const MIN_H = 160
const MAX_W = 900
const MAX_H = 700

export default function ImageAssetNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as ImageAssetData
  const def = NODE_MAP[d.nodeType]
  const { nodeStatuses, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const [size, setSize] = useState({ w: d.width ?? 300, h: d.height ?? 220 })
  const sizeRef = useRef(size)
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => { sizeRef.current = size }, [size])

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    nodeResize(event)
    resizeRef.current = { x: event.clientX, y: event.clientY, w: sizeRef.current.w, h: sizeRef.current.h }
    const onMove = (moveEvent: PointerEvent) => {
      if (!resizeRef.current) return
      setSize({
        w: Math.min(MAX_W, Math.max(MIN_W, resizeRef.current.w + moveEvent.clientX - resizeRef.current.x)),
        h: Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.h + moveEvent.clientY - resizeRef.current.y)),
      })
    }
    const onUp = () => {
      updateNodeData(id, { width: sizeRef.current.w, height: sizeRef.current.h })
      resizeRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [id, updateNodeData])

  if (!def) return null
  const src = resolveLocalImageSrc(d.filePath)

  return (
    <div style={{ position: "relative" }}>
      <NodeBase
        title={d.title || def.label}
        category={def.category}
        icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-secondary)" }}>image</span>}
        outputs={def.outputs}
        status={status}
        selected={selected}
        nodeId={id}
        width={size.w}
      >
        <div
          onDoubleClick={() => useOverlayStore.getState().openEditor(id)}
          style={{ height: size.h - 96, minHeight: 80, cursor: "zoom-in" }}
        >
          {src ? (
            <img src={src} alt={d.description ?? d.title ?? "Image"} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8, background: "#fff" }} />
          ) : (
            <div style={{ height: "100%", borderRadius: 8, background: "var(--bg-hover)", display: "grid", placeItems: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              拖入或选择图片素材
            </div>
          )}
        </div>
      </NodeBase>
      <div onPointerDown={handleResizeStart} style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, cursor: "se-resize", zIndex: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, opacity: 0.45 }}>drag_handle</span>
      </div>
    </div>
  )
}
