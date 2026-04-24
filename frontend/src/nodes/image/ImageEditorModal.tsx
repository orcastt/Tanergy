import { useCallback, useState } from "react"
import SourcePanel from "./SourcePanel"
import LayerCanvas, { getCanvasElement } from "./LayerCanvas"
import LayerPanel from "./LayerPanel"
import Toolbar from "./Toolbar"
import AiEditPopup from "./AiEditPopup"
import { useLayerStore } from "./layerStore"
import { useCanvasStore } from "../../store/canvasStore"
import { invoke } from "@tauri-apps/api/core"

interface ImageItem {
  id: string
  file_path: string
  description: string
  prompt: string
  position: string
}

interface Props {
  nodeId: string
  onClose: () => void
}

export default function ImageEditorModal({ nodeId, onClose }: Props) {
  const result = useCanvasStore((s) => s.nodeResults[nodeId]) as { images?: ImageItem[] } | undefined
  const images = result?.images ?? []
  const { rasterize, reset, addImageLayer } = useLayerStore()
  const [showAiPopup, setShowAiPopup] = useState(false)

  const handleRasterize = useCallback(() => {
    const canvasEl = getCanvasElement()
    if (!canvasEl) return
    const dataUrl = canvasEl.toDataURL("image/png")
    rasterize(dataUrl)
  }, [rasterize])

  const doExport = useCallback(async (closeAfter = false) => {
    const canvasEl = getCanvasElement()
    if (!canvasEl) return
    const dataUrl = canvasEl.toDataURL("image/png")
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")

    try {
      const saveResult = await invoke<{ file_path: string }>("save_canvas_export", {
        base64Data: base64,
        workflowId: "exported",
        nodeId,
      })
      const newImage = {
        id: `export_${Date.now()}`,
        plan_id: "export",
        file_path: saveResult.file_path,
        prompt: "Canvas export",
        description: "导出图片",
        position: "",
      }
      const currentResult = useCanvasStore.getState().nodeResults[nodeId] as { images?: ImageItem[] } | undefined
      const currentImages = currentResult?.images ?? []
      useCanvasStore.getState().setNodeResult(nodeId, {
        ...currentResult,
        images: [...currentImages, newImage],
      })
      if (closeAfter) onClose()
    } catch (e) {
      console.error("Export failed:", e)
    }
  }, [nodeId, onClose])

  const handleExport = useCallback(() => doExport(true), [doExport])
  const handleExportToNode = useCallback(() => doExport(false), [doExport])

  const handleBack = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  function handleAiResult(base64: string) {
    const dataUrl = `data:image/png;base64,${base64}`
    addImageLayer(dataUrl, "AI 生成")
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", flexDirection: "column",
      background: "var(--bg-surface)", pointerEvents: "auto",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
        borderBottom: "1px solid var(--border-color)", flexShrink: 0,
        background: "var(--bg-surface)",
      }}>
        <button onClick={handleBack} style={{
          width: "32px", height: "32px", borderRadius: "0.5rem", border: "none",
          background: "var(--bg-hover)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
        </button>
        <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>Image Editor</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {images.length} 张图片
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleRasterize} style={{
          padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border-color)",
          background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "0.75rem",
          fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>layers</span>
          栅格化
        </button>
        <button onClick={handleExport} style={{
          padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none",
          background: "#22C55E", color: "#fff", fontSize: "0.75rem",
          fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
          导出到节点
        </button>
      </div>

      <Toolbar onAiEdit={() => setShowAiPopup(true)} />

      {/* Body: three columns */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <SourcePanel images={images} />
        <LayerCanvas />
        <LayerPanel onExportLayer={handleExportToNode} />

        {/* AI Edit popup — centered over the body */}
        {showAiPopup && (
          <AiEditPopup
            onResult={handleAiResult}
            onClose={() => setShowAiPopup(false)}
          />
        )}
      </div>
    </div>
  )
}
