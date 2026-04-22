import { useState, useEffect, useMemo } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import { invoke } from "@tauri-apps/api/core"
import type { PortDef } from "./base/NodeBase"

interface GeneratedImage {
  id: string
  plan_id: string
  file_path: string
  prompt: string
  description: string
  position: string
}

function ImageThumb({ filePath, description, badge }: { filePath: string; description: string; badge?: number }) {
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
      {badge != null && (
        <div style={{
          position: "absolute", top: 2, left: 2, minWidth: "14px", height: "14px",
          background: "#3B82F6", color: "#fff", borderRadius: "7px",
          fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "0 3px", lineHeight: 1,
        }}>{badge}</div>
      )}
    </div>
  )
}

const MODELS = [
  { value: "minimax", label: "MiniMax" },
  { value: "gpt", label: "GPT Image" },
  { value: "gemini", label: "Gemini" },
]

export default function ImageListNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string; count?: number; model?: string; imageInputs?: string[] }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS["image_gen"] ?? 0
  const { nodeStatuses, nodeResults, updateNodeData, edges } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { images?: GeneratedImage[] } | undefined
  const images = result?.images ?? []

  const count = d.count ?? 1
  const model = d.model ?? "minimax"
  const imageInputs: string[] = d.imageInputs ?? ["img_in_1"]

  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | null = null
    if (status === "running") {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<{ node_id: string; progress: number; total: number }>("node_progress", (event) => {
          if (event.payload.node_id === id) {
            setProgress({ current: event.payload.progress, total: event.payload.total })
          }
        }).then((fn) => { unlisten = fn })
      })
    } else {
      setProgress(null)
    }
    return () => { unlisten?.() }
  }, [status, id])

  // Collect connected image inputs from edges
  const connectedImageInputs = useMemo(() => {
    const incoming = edges
      .filter((e) => e.target === id && e.targetHandle?.startsWith("img_in_"))
      .map((e) => ({ handleId: e.targetHandle!, sourceNodeId: e.source }))
    return incoming
  }, [edges, id])

  // Dynamic inputs: static (image_plans + text) + dynamic image inputs
  const inputs: PortDef[] = useMemo(() => {
    const base = [...def.inputs]
    for (const inputId of imageInputs) {
      base.push({ id: inputId, type: "image_slot" as const, label: `图${base.length}` })
    }
    return base
  }, [imageInputs, def.inputs])

  // Dynamic output ports
  const outputs: PortDef[] = useMemo(() => {
    if (images.length > 0) {
      return images.map((_img, i) => ({ id: `image${i + 1}`, type: "image_slot" as const, label: `图${i + 1}` }))
    }
    const num = Math.min(count, 10)
    return Array.from({ length: num }, (_, i) => ({ id: `image${i + 1}`, type: "image_slot" as const, label: `图${i + 1}` }))
  }, [images.length, count])

  function addImageInput() {
    const nextIdx = imageInputs.length + 1
    const newId = `img_in_${nextIdx}`
    // Ensure unique id
    const existing = new Set(imageInputs)
    let candidate = newId
    while (existing.has(candidate)) {
      candidate = `img_in_${Date.now()}`
    }
    updateNodeData(id, { imageInputs: [...imageInputs, candidate] })
  }

  function removeImageInput(inputId: string) {
    if (imageInputs.length <= 1) return
    updateNodeData(id, { imageInputs: imageInputs.filter((x) => x !== inputId) })
  }

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "0.25rem 0.375rem", fontSize: "0.6875rem",
    border: "1px solid var(--border-color)", borderRadius: "0.25rem",
    background: "var(--bg-input)", color: "var(--text-primary)",
    outline: "none", fontFamily: '"Inter", sans-serif',
  }

  return (
    <>
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--text-secondary)" }}>photo_library</span>}
      inputs={inputs}
      outputs={outputs}
      status={status}
      selected={selected}
      nodeId={id}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      {/* Count & Model selectors — idle state */}
      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", minWidth: "2rem" }}>数量</label>
            <select value={count} onChange={(e) => updateNodeData(id, { count: Number(e.target.value) })} style={selectStyle}>
              {Array.from({ length: 10 }, (_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", minWidth: "2rem" }}>模型</label>
            <select value={model} onChange={(e) => updateNodeData(id, { model: e.target.value })} style={selectStyle}>
              {MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>

          {/* Add image input button */}
          <button onClick={addImageInput} style={{
            padding: "0.25rem 0.5rem", fontSize: "0.6875rem", borderRadius: "0.25rem",
            border: "1px dashed var(--border-color)", background: "transparent",
            color: "var(--text-secondary)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
            添加图片输入 ({imageInputs.length})
          </button>
        </div>
      )}

      {/* Connected image inputs with thumbnails and order badges */}
      {connectedImageInputs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: "0.25rem" }}>
          {connectedImageInputs.map((conn, i) => {
            const srcResult = nodeResults[conn.sourceNodeId] as { images?: GeneratedImage[] } | undefined
            const firstImg = srcResult?.images?.[0]
            return (
              <div key={conn.handleId} style={{ position: "relative" }}>
                {firstImg ? (
                  <ImageThumb filePath={firstImg.file_path} description={firstImg.description} badge={i + 1} />
                ) : (
                  <div style={{
                    aspectRatio: "4/3", background: "var(--bg-hover)", borderRadius: "0.25rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", color: "var(--text-secondary)", position: "relative",
                  }}>
                    图{i + 1}
                    <div style={{
                      position: "absolute", top: 2, left: 2, minWidth: "14px", height: "14px",
                      background: "#3B82F6", color: "#fff", borderRadius: "7px",
                      fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center",
                      justifyContent: "center", padding: "0 3px", lineHeight: 1,
                    }}>{i + 1}</div>
                  </div>
                )}
                {status === "idle" && imageInputs.length > 1 && (
                  <button onClick={() => removeImageInput(conn.handleId)} style={{
                    position: "absolute", top: 2, right: 2, width: "14px", height: "14px",
                    background: "rgba(0,0,0,0.5)", color: "#fff", border: "none",
                    borderRadius: "50%", fontSize: "8px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}>×</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Running progress */}
      {status === "running" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{
            padding: "0.5rem", background: "#eff6ff", borderRadius: "0.25rem",
            fontSize: "0.75rem", color: "#1d4ed8",
            display: "flex", alignItems: "center", gap: "0.375rem",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
            {progress ? `生成中 ${progress.current}/${progress.total}...` : "准备生成..."}
          </div>
          {progress && (
            <div style={{ height: "4px", background: "var(--border-color)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: "100%", background: "#3B82F6", borderRadius: "2px",
                transition: "width 0.3s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Generated images grid — double click to open editor */}
      {images.length > 0 && status === "done" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: "0.25rem", cursor: "pointer" }}
          onDoubleClick={() => useOverlayStore.getState().openEditor(id)}
        >
          {images.map((img) => (
            <ImageThumb key={img.id} filePath={img.file_path} description={img.description} />
          ))}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          生成失败，请检查 API Key
        </div>
      )}
    </NodeBase>

    </>
  )
}
