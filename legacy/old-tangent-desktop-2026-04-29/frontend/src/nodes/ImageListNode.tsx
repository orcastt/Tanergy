import { useState, useEffect, useMemo, useCallback } from "react"
import type { NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useOverlayStore } from "../store/overlayStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import type { PortDef } from "./base/NodeBase"
import ModelSelector from "../components/ModelSelector"
import { ImageThumb, InputThumb, type GeneratedImage } from "./ImageListThumbs"
import { resolveDefaultModel, useOfficialModelsStore } from "../store/officialModelsStore"

const MAX_IMAGE_INPUTS = 10
const EMPTY_PORTS: PortDef[] = []
const GPT_IMAGE_2_SIZES = ["1024x1024", "1024x1536", "1536x1024"]
const GPT_IMAGE_2_QUALITIES = ["low", "medium", "high"]
const GEMINI_IMAGE_SIZES = ["0.5K", "1K", "2K", "4K"]

export default function ImageListNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string; count?: number; model?: string; imageInputs?: string[]; size?: string; quality?: string; image_size?: string }
  const def = NODE_MAP[d.nodeType]

  const { t } = useTranslation()
  const { isLoggedIn } = useCreditsStore()
  const remoteModels = useOfficialModelsStore((s) => s.models)
  const creditCost = NODE_CREDIT_COSTS["image_gen"] ?? 0
  const { nodeStatuses, nodeResults, updateNodeData, edges } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { images?: GeneratedImage[] } | undefined
  const images = result?.images ?? []

  const count = d.count ?? 1
  const selectedModel = d.model ?? resolveDefaultModel("image", remoteModels)
  const imageInputs = useMemo(() => d.imageInputs ?? ["img_in_1"], [d.imageInputs])

  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  // Auto-sync count from upstream image_plans array length
  useEffect(() => {
    const plansEdge = edges.find((e) => e.target === id && e.targetHandle === "in")
    if (!plansEdge) return
    const upstream = nodeResults[plansEdge.source] as
      | { image_plans?: unknown[] }
      | unknown[]
      | undefined
    const planCount = Array.isArray(upstream)
      ? upstream.length
      : (upstream as { image_plans?: unknown[] } | undefined)?.image_plans?.length ?? 0
    if (planCount > 0 && planCount !== count) {
      updateNodeData(id, { count: planCount })
    }
  }, [edges, id, nodeResults, count, updateNodeData])

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
    }
    return () => { unlisten?.() }
  }, [status, id])

  const connectedImageInputs = useMemo(() => {
    const incoming = edges
      .filter((e) => e.target === id && e.targetHandle?.startsWith("img_in_"))
      .map((e) => ({ handleId: e.targetHandle!, sourceNodeId: e.source }))
    return incoming
  }, [edges, id])

  const addImageInput = useCallback(() => {
    if (imageInputs.length >= MAX_IMAGE_INPUTS) return
    const existing = new Set(imageInputs)
    let candidate = `img_in_${imageInputs.length + 1}`
    while (existing.has(candidate)) {
      candidate = `img_in_${Date.now()}`
    }
    updateNodeData(id, { imageInputs: [...imageInputs, candidate] })
  }, [imageInputs, id, updateNodeData])

  const removeImageInput = useCallback((inputId: string) => {
    if (imageInputs.length <= 1) return
    updateNodeData(id, { imageInputs: imageInputs.filter((x) => x !== inputId) })
  }, [imageInputs, id, updateNodeData])

  const inputs: PortDef[] = useMemo(() => {
    const base: PortDef[] = [...(def?.inputs ?? EMPTY_PORTS)]
    for (const inputId of imageInputs) {
      base.push({
        id: inputId, type: "image_slot" as const, label: `图${base.length}`,
        removable: imageInputs.length > 1,
        onRemove: removeImageInput,
      })
    }
    return base
  }, [imageInputs, def?.inputs, removeImageInput])

  // Outputs: individual image handles (no label = hidden from bottom bar) + "out" for full images array
  const outputs: PortDef[] = useMemo(() => {
    const imagePorts = images.length > 0
      ? Array.from({ length: images.length }, (_, i) => ({ id: `image${i + 1}`, type: "image_slot" as const }))
      : Array.from({ length: Math.min(count, 10) }, (_, i) => ({ id: `image${i + 1}`, type: "image_slot" as const }))
    return [...imagePorts, { id: "out", type: "image_slot" as const, label: "All" }]
  }, [images.length, count])

  const runningProgress = status === "running" ? progress : null

  if (!def) return null

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
            <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", minWidth: "2rem" }}>{t("nodes.image_planner.count")}</label>
            <select value={count} onChange={(e) => updateNodeData(id, { count: Number(e.target.value) })} style={selectStyle}>
              {Array.from({ length: 10 }, (_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", minWidth: "2rem" }}>{t("nodes.image_planner.style")}</label>
            <ModelSelector
              category="image"
              value={d.model as string | undefined}
              onChange={(model) => updateNodeData(id, { model })}
            />
          </div>
          {selectedModel === "gpt-image-2" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                {t("nodes.image_list.size")}
                <select value={d.size ?? ""} onChange={(e) => updateNodeData(id, { size: e.target.value || undefined })} style={{ ...selectStyle, marginTop: "0.25rem" }}>
                  <option value="">{t("nodes.image_list.autoSize")}</option>
                  {GPT_IMAGE_2_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                {t("nodes.image_list.quality")}
                <select value={d.quality ?? "low"} onChange={(e) => updateNodeData(id, { quality: e.target.value })} style={{ ...selectStyle, marginTop: "0.25rem" }}>
                  {GPT_IMAGE_2_QUALITIES.map((quality) => <option key={quality} value={quality}>{t(`nodes.image_list.quality_${quality}`)}</option>)}
                </select>
              </label>
            </div>
          )}
          {selectedModel === "gemini-3.1-flash-image-preview" && (
            <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
              {t("nodes.image_list.imageSize")}
              <select value={d.image_size ?? "0.5K"} onChange={(e) => updateNodeData(id, { image_size: e.target.value })} style={{ ...selectStyle, marginTop: "0.25rem" }}>
                {GEMINI_IMAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          )}

          {/* Add image input button */}
          {imageInputs.length < MAX_IMAGE_INPUTS && (
            <button onClick={addImageInput} style={{
              padding: "0.25rem 0.5rem", fontSize: "0.6875rem", borderRadius: "0.25rem",
              border: "1px dashed var(--border-color)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
              {t("nodes.image_list.addImageInput", { count: imageInputs.length })}
            </button>
          )}
        </div>
      )}

      {/* Connected image inputs with thumbnails and hover-delete */}
      {connectedImageInputs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: "0.25rem" }}>
          {connectedImageInputs.map((conn, i) => {
            const srcResult = nodeResults[conn.sourceNodeId] as { images?: GeneratedImage[] } | undefined
            const firstImg = srcResult?.images?.[0]
            return (
              <InputThumb
                key={conn.handleId}
                handleId={conn.handleId}
                index={i}
                firstImg={firstImg}
                canDelete={status === "idle" && imageInputs.length > 1}
                onDelete={removeImageInput}
              />
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
            {runningProgress ? t("nodes.image_list.generating", { current: runningProgress.current, total: runningProgress.total }) : t("nodes.image_list.ready")}
          </div>
          {runningProgress && (
            <div style={{ height: "4px", background: "var(--border-color)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                width: `${(runningProgress.current / runningProgress.total) * 100}%`,
                height: "100%", background: "#3B82F6", borderRadius: "2px",
                transition: "width 0.3s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Done — show preview grid, click opens Image Editor */}
      {images.length > 0 && status === "done" && (
        <div
          onClick={() => useOverlayStore.getState().openEditor(id)}
          style={{
            display: "grid", gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`,
            gap: "0.25rem", cursor: "pointer",
          }}
        >
          {images.map((img, i) => (
            <ImageThumb key={img.id} filePath={img.file_path} description={img.description} badge={i + 1} />
          ))}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          {t("nodes.image_list.error")}
        </div>
      )}
    </NodeBase>

    </>
  )
}
