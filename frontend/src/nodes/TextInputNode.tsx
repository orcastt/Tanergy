import { useCallback, useRef, useState } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { nodeResize } from "../lib/nodeEvents"

interface TextInputData {
  nodeType: string
  text: string
  width?: number
  height?: number
}

const MIN_W = 256
const MIN_H = 120
const MAX_H = 600

export default function TextInputNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as TextInputData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined

  const [size, setSize] = useState({ w: d.width ?? 256, h: d.height ?? 160 })
  const sizeRef = useRef(size)
  sizeRef.current = size

  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    nodeResize(e)
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: sizeRef.current.w, startH: sizeRef.current.h }

    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      const newW = Math.max(MIN_W, resizeRef.current.startW + dx)
      const newH = Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.startH + dy))
      setSize({ w: newW, h: newH })
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

  const lineH = 20
  const headerH = 40
  const portBarH = 28
  const padding = 16
  const textH = size.h - headerH - portBarH - padding * 2 - 8
  const clampedTextH = Math.max(lineH * 2, textH)

  return (
    <div style={{ position: "relative" }}>
      <NodeBase
        title={def.label}
        category={def.category}
        icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--text-secondary)" }}>edit_note</span>}
        inputs={def.inputs}
        outputs={def.outputs}
        status={status}
        selected={selected}
        nodeId={id}
        width={size.w}
      >
        <textarea
          value={d.text ?? ""}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="输入主题、关键词或文章要求..."
          style={{
            width: "100%",
            height: `${clampedTextH}px`,
            border: "1px solid var(--border-color)",
            borderRadius: "0.375rem",
            padding: "0.5rem",
            fontSize: "0.8125rem",
            lineHeight: `${lineH}px`,
            color: "var(--text-primary)",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            background: "var(--bg-input)",
            overflowY: "auto",
          }}
        />
        {result?.text && status === "done" && (
          <div style={{
            marginTop: "0.375rem",
            padding: "0.375rem 0.5rem",
            background: "#f0fdf4",
            borderRadius: "0.25rem",
            fontSize: "0.6875rem",
            color: "#166534",
          }}>
            ✓ 输出就绪
          </div>
        )}
      </NodeBase>

      {/* Resize handle — bottom-right corner */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: "absolute", right: 0, bottom: 0,
          width: "14px", height: "14px", cursor: "se-resize", zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.4 }}>
          <circle cx="6" cy="2" r="1" fill="currentColor" />
          <circle cx="2" cy="6" r="1" fill="currentColor" />
          <circle cx="6" cy="6" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}
