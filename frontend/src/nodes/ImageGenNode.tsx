import { useState, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import { invoke } from "@tauri-apps/api/core"
import ModelSelector from "../components/ModelSelector"

interface GeneratedImage {
  id: string
  plan_id: string
  file_path: string
  prompt: string
  description: string
  position: string
}

function ImageThumb({ filePath, description }: { filePath: string; description: string }) {
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

  if (!src) {
    return (
      <div style={{
        width: "100%", aspectRatio: "4/3", background: "#f3f4f6",
        borderRadius: "0.25rem", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "0.625rem", color: "#9ca3af",
      }}>
        加载中...
      </div>
    )
  }

  return (
    <div style={{ width: "100%" }}>
      <img
        src={src}
        alt={description}
        style={{
          width: "100%", borderRadius: "0.25rem", objectFit: "cover",
          maxHeight: "80px",
        }}
      />
    </div>
  )
}

export default function ImageGenNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as { nodeType: string; model?: string }
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { images?: GeneratedImage[] } | undefined

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

  const images = result?.images ?? []

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>photo_camera</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>Model:</span>
        <ModelSelector
          category="image"
          value={d.model as string | undefined}
          onChange={(model) => updateNodeData(id, { model })}
        />
      </div>
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
            <div style={{ height: "4px", background: "#e3e2e2", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: "100%", background: "#3B82F6", borderRadius: "2px",
                transition: "width 0.3s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {images.length > 0 && status === "done" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: "0.25rem" }}>
          {images.map((img) => (
            <ImageThumb key={img.id} filePath={img.file_path} description={img.description} />
          ))}
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          连接配图方案，点击 Run 生成
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          生成失败，请检查 API Key
        </div>
      )}
    </NodeBase>
  )
}
