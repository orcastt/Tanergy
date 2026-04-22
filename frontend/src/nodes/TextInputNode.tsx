import { useCallback, useRef, useState } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

interface TextInputData {
  nodeType: string
  text: string
  width?: number
  height?: number
}

const MIN_WIDTH = 256
const MIN_HEIGHT = 120
const MAX_HEIGHT = 300

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
  const resizing = useRef<{ corner: string; startX: number; startY: number; startW: number; startH: number } | null>(null)

  const handleMouseDown = useCallback((corner: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = { corner, startX: e.clientX, startY: e.clientY, startW: sizeRef.current.w, startH: sizeRef.current.h }

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const dx = ev.clientX - resizing.current.startX
      const dy = ev.clientY - resizing.current.startY
      const newW = Math.max(MIN_WIDTH, resizing.current.startW + dx)
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizing.current.startH + dy))
      setSize({ w: newW, h: newH })
    }

    const onUp = () => {
      updateNodeData(id, { width: sizeRef.current.w, height: sizeRef.current.h })
      resizing.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [id, updateNodeData])

  const lineH = 20
  const maxLines = Math.floor((size.h - 60) / lineH)
  const maxTextH = maxLines * lineH

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
            height: `${maxTextH}px`,
            maxHeight: `${maxTextH}px`,
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

      {/* Resize handles — 4 corners */}
      <div onMouseDown={(e) => handleMouseDown("se", e)} style={{
        position: "absolute", right: -4, bottom: -4, width: 10, height: 10, cursor: "se-resize", zIndex: 20,
      }} />
      <div onMouseDown={(e) => handleMouseDown("sw", e)} style={{
        position: "absolute", left: -4, bottom: -4, width: 10, height: 10, cursor: "sw-resize", zIndex: 20,
      }} />
      <div onMouseDown={(e) => handleMouseDown("ne", e)} style={{
        position: "absolute", right: -4, top: -4, width: 10, height: 10, cursor: "ne-resize", zIndex: 20,
      }} />
      <div onMouseDown={(e) => handleMouseDown("nw", e)} style={{
        position: "absolute", left: -4, top: -4, width: 10, height: 10, cursor: "nw-resize", zIndex: 20,
      }} />
    </div>
  )
}
