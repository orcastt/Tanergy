import { useMemo, useCallback } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import type { PortDef } from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"
import { toStandardPurpleHtml } from "./image/standardPurpleHtml"

interface HtmlFormatterData {
  nodeType: string
  style: string
  fontSize: number
  lineHeight: number
  model?: string
  textInputs?: string[]
  imageInputs?: string[]
}

const MAX_SECTION_INPUTS = 10
const MAX_IMAGE_INPUTS = 10
const STYLES = ["标准紫", "经典", "简约", "活泼", "专业"]

export default function HtmlFormatterNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as HtmlFormatterData
  const def = NODE_MAP[d.nodeType]

  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { html?: string; word_count?: number; reading_time?: number } | undefined

  const textInputs = useMemo(() => d.textInputs ?? ["text_1"], [d.textInputs])
  const imageInputs = useMemo(() => d.imageInputs ?? ["images"], [d.imageInputs])

  const addTextInput = useCallback(() => {
    if (textInputs.length >= MAX_SECTION_INPUTS) return
    const next = `text_${textInputs.length + 1}`
    updateNodeData(id, { textInputs: [...textInputs, next] })
  }, [textInputs, id, updateNodeData])

  const removeTextInput = useCallback((portId: string) => {
    if (textInputs.length <= 1) return
    updateNodeData(id, { textInputs: textInputs.filter((p) => p !== portId) })
  }, [textInputs, id, updateNodeData])

  const addImageInput = useCallback(() => {
    if (imageInputs.length >= MAX_IMAGE_INPUTS) return
    const next = `image_${imageInputs.length + 1}`
    updateNodeData(id, { imageInputs: [...imageInputs, next] })
  }, [imageInputs, id, updateNodeData])

  const removeImageInput = useCallback((portId: string) => {
    if (imageInputs.length <= 1) return
    updateNodeData(id, { imageInputs: imageInputs.filter((p) => p !== portId) })
  }, [imageInputs, id, updateNodeData])

  const dynamicInputs = useMemo((): PortDef[] => {
    const sections: PortDef[] = textInputs.map((portId, i) => ({
      id: portId,
      type: "text",
      label: `Section ${i + 1}`,
      removable: textInputs.length > 1,
      onRemove: removeTextInput,
    }))
    const images: PortDef[] = imageInputs.map((portId, i) => ({
      id: portId,
      type: "image_slot",
      label: `Image ${i + 1}`,
      removable: imageInputs.length > 1,
      onRemove: removeImageInput,
    }))
    return [...sections, ...images]
  }, [textInputs, imageInputs, removeTextInput, removeImageInput])
  const nodeWidth = dynamicInputs.length >= 8 ? 340 : 300

  function copyHtml() {
    if (result?.html) navigator.clipboard.writeText(toStandardPurpleHtml(result.html)).catch(() => {})
  }

  if (!def) return null

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>code</span>}
      inputs={dynamicInputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
      width={nodeWidth}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      {/* Model + Style row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>Model:</span>
        <ModelSelector category="text" value={d.model} onChange={(model) => updateNodeData(id, { model })} />
      </div>
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => updateNodeData(id, { style: s })}
            className="nodrag nopan"
            style={{
              padding: "0.125rem 0.5rem", fontSize: "0.625rem", borderRadius: "9999px",
              border: d.style === s ? "1px solid #7C3AED" : "1px solid var(--border-color)",
              background: d.style === s ? "#f5f3ff" : "transparent",
              color: d.style === s ? "#7C3AED" : "var(--text-secondary)",
              cursor: "pointer", fontWeight: d.style === s ? 600 : 400,
            }}
          >{s}</button>
        ))}
      </div>

      {/* Section ports manager — shown when idle */}
      {status === "idle" && (
        <div style={{ marginBottom: "0.375rem" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>章节输入</div>
          {textInputs.map((portId, i) => (
            <div key={portId} style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.125rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6", flexShrink: 0 }} />
              <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)", flex: 1 }}>Section {i + 1}</span>
              {textInputs.length > 1 && (
                <button
                  onClick={() => removeTextInput(portId)}
                  className="nodrag nopan"
                  style={{ fontSize: "0.75rem", background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                >−</button>
              )}
            </div>
          ))}
          {textInputs.length < MAX_SECTION_INPUTS && (
            <button
              onClick={addTextInput}
              className="nodrag nopan"
              style={{
                fontSize: "0.625rem", color: "#3B82F6", background: "none",
                border: "1px dashed #3B82F6", borderRadius: "0.25rem",
                padding: "0.125rem 0.5rem", cursor: "pointer", marginTop: "0.125rem",
              }}
            >+ 添加章节</button>
          )}
          <div style={{ fontSize: "0.625rem", color: "var(--text-secondary)", margin: "0.5rem 0 0.25rem" }}>图片输入</div>
          {imageInputs.map((portId, i) => (
            <div key={portId} style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.125rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#86EFAC", flexShrink: 0 }} />
              <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)", flex: 1 }}>Image {i + 1}</span>
              {imageInputs.length > 1 && (
                <button
                  onClick={() => removeImageInput(portId)}
                  className="nodrag nopan"
                  style={{ fontSize: "0.75rem", background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                >−</button>
              )}
            </div>
          ))}
          {imageInputs.length < MAX_IMAGE_INPUTS && (
            <button
              onClick={addImageInput}
              className="nodrag nopan"
              style={{
                fontSize: "0.625rem", color: "#22C55E", background: "none",
                border: "1px dashed #22C55E", borderRadius: "0.25rem",
                padding: "0.125rem 0.5rem", cursor: "pointer", marginTop: "0.125rem",
              }}
            >+ 添加图片输入</button>
          )}
        </div>
      )}

      {status === "running" && (
        <div style={{
          padding: "0.5rem", background: "#eff6ff", borderRadius: "0.25rem",
          fontSize: "0.75rem", color: "#1d4ed8",
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
          正在排版中...
        </div>
      )}

      {status === "done" && result?.html && (
        <div
          onDoubleClick={() => useOverlayStore.getState().openHtmlEditor(id)}
          style={{ display: "flex", flexDirection: "column", gap: "0.375rem", cursor: "pointer" }}
        >
          <div style={{
            padding: "0.75rem", background: "#f5f3ff", borderRadius: "0.375rem",
            border: "1px solid #ede9fe", textAlign: "center", color: "#6d28d9",
            fontSize: "0.75rem",
          }}>
            <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>📝</div>
            双击编辑文章
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#9ca3af" }}>
              {result.word_count?.toLocaleString()} 字 · 约 {result.reading_time} 分钟
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); copyHtml() }}
              className="nodrag nopan"
              style={{ padding: "0.125rem 0.5rem", fontSize: "0.625rem", border: "1px solid #6349EA", borderRadius: "0.25rem", cursor: "pointer", background: "#6349EA", color: "#fff" }}
            >复制 HTML</button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: "0.375rem 0.5rem", background: "#fef2f2", borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b" }}>
          执行失败，请检查 API Key
        </div>
      )}
    </NodeBase>
  )
}
