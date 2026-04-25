import { useCallback, useState, useEffect } from "react"
import SourcePanel from "./SourcePanel"
import LayerCanvas, { rasterizeLayers, captureCanvasDisplay } from "./LayerCanvas"
import LayerPanel from "./LayerPanel"
import Toolbar from "./Toolbar"
import AiEditPopup from "./AiEditPopup"
import { useLayerStore } from "./layerStore"
import { useCanvasStore } from "../../store/canvasStore"

interface ImageItem {
  id: string
  plan_id?: string
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
  const { rasterize, reset, addImageLayer, getState, restoreState } = useLayerStore()
  const [showAiPopup, setShowAiPopup] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Restore saved layer data for this node, or reset to clean slate
  useEffect(() => {
    const saved = (useCanvasStore.getState().nodeResults[nodeId] as any)?.layerData
    if (saved) restoreState(saved)
    else reset()
  }, [nodeId, reset, restoreState])

  const handleRasterize = useCallback(() => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (dataUrl) rasterize(dataUrl)
  }, [rasterize])

  const doExport = useCallback(async (closeAfter = false) => {
    const dataUrl = captureCanvasDisplay()
    if (!dataUrl) { setExportError("画布未就绪"); return }

    const newImage: ImageItem = {
      id: `export_${Date.now()}`,
      plan_id: "export",
      file_path: dataUrl,
      prompt: "Canvas export",
      description: "导出图片",
      position: "",
    }
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as any
    const currentImages: ImageItem[] = currentResult?.images ?? []
    const layerData = getState()
    useCanvasStore.getState().setNodeResult(nodeId, {
      ...currentResult,
      images: [...currentImages, newImage],
      layerData,
    })
    setExportError(null)
    if (closeAfter) onClose()
  }, [nodeId, onClose, getState])

  const handleExport = useCallback(() => doExport(true), [doExport])
  const handleExportToNode = useCallback(() => doExport(false), [doExport])

  const handleBack = useCallback(() => {
    // Save layer data to node results before closing
    const layerData = getState()
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as any
    useCanvasStore.getState().setNodeResult(nodeId, { ...currentResult, layerData })
    reset()
    onClose()
  }, [nodeId, reset, onClose, getState])

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
        {exportError && (
          <span style={{ fontSize: "0.6875rem", color: "#EF4444" }}>导出失败: {exportError}</span>
        )}
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
