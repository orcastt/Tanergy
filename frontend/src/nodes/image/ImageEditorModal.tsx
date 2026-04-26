import { useCallback, useMemo, useState, useEffect } from "react"
import SourcePanel from "./SourcePanel"
import LayerCanvas from "./LayerCanvas"
import LayerPanel from "./LayerPanel"
import Toolbar from "./Toolbar"
import AiEditPopup from "./AiEditPopup"
import { useLayerStore, type Layer } from "./layerStore"
import { captureCanvasDisplay, rasterizeLayers } from "./layerCanvasRuntime"
import { useCanvasStore } from "../../store/canvasStore"
import { useWorkflowStore } from "../../store/workflowStore"
import LibrarySaveDialog from "../../library/LibrarySaveDialog"

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

interface ImageEditorResult {
  images?: ImageItem[]
  layerData?: unknown
}

interface LayerSnapshot {
  layers: Layer[]
  activeLayerId: string | null
  showGrid: boolean
  snapEnabled: boolean
}

function isLayerSnapshot(value: unknown): value is LayerSnapshot {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { layers?: unknown }).layers))
}

export default function ImageEditorModal({ nodeId, onClose }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const result = useCanvasStore((s) => s.nodeResults[nodeId]) as ImageEditorResult | undefined
  const nodeData = node?.data as Record<string, unknown> | undefined
  const nodeType = nodeData?.nodeType
  const filePath = typeof nodeData?.filePath === "string" ? nodeData.filePath : ""
  const libraryItemId = typeof nodeData?.libraryItemId === "string" ? nodeData.libraryItemId : nodeId
  const title = typeof nodeData?.title === "string" ? nodeData.title : "Library image"
  const description = typeof nodeData?.description === "string" ? nodeData.description : title
  const nodeImage = useMemo(() => nodeType === "image_asset" && filePath
    ? [{
        id: libraryItemId,
        file_path: filePath,
        description,
        prompt: title,
        position: "",
      }]
    : [], [description, filePath, libraryItemId, nodeType, title])
  const images = result?.images ?? nodeImage
  const workflowId = useWorkflowStore((s) => s.currentWorkflow?.id)
  const { rasterize, reset, addImageLayer, getState, restoreState } = useLayerStore()
  const [showAiPopup, setShowAiPopup] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState("")
  const [libraryDataUrl, setLibraryDataUrl] = useState<string | null>(null)

  // Restore saved layer data for this node, or reset to clean slate
  useEffect(() => {
    const saved = (useCanvasStore.getState().nodeResults[nodeId] as ImageEditorResult | undefined)?.layerData
    if (isLayerSnapshot(saved)) restoreState(saved)
    else reset()
    if (!saved && nodeImage[0]?.file_path) {
      addImageLayer(nodeImage[0].file_path, nodeImage[0].description)
    }
  }, [addImageLayer, nodeId, nodeImage, reset, restoreState])

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
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as ImageEditorResult | undefined
    const currentImages: ImageItem[] = currentResult?.images ?? []
    const layerData = getState()
    useCanvasStore.getState().setNodeResult(nodeId, {
      ...(currentResult ?? {}),
      images: [...currentImages, newImage],
      layerData,
    })
    if (nodeType === "image_asset") {
      useCanvasStore.getState().updateNodeData(nodeId, { filePath: dataUrl, description: "导出图片" })
    }
    setExportError(null)
    if (closeAfter) onClose()
  }, [getState, nodeId, nodeType, onClose])

  const handleExport = useCallback(() => doExport(true), [doExport])
  const handleExportToNode = useCallback(() => doExport(false), [doExport])

  const handleSave = useCallback(() => {
    const layerData = getState()
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as ImageEditorResult | undefined
    useCanvasStore.getState().setNodeResult(nodeId, { ...(currentResult ?? {}), layerData, images })
    setSaveStatus("已保存")
    setTimeout(() => setSaveStatus(""), 1500)
  }, [getState, images, nodeId])

  const handleDownload = useCallback(() => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl) { setExportError("画布未就绪"); return }
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `tanvas-image-${Date.now()}.png`
    link.click()
  }, [])

  const handleCopy = useCallback(async () => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl || !navigator.clipboard?.write) { setExportError("剪贴板不可用"); return }
    const blob = dataUrlToBlob(dataUrl)
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    setSaveStatus("已复制图片")
    setTimeout(() => setSaveStatus(""), 1500)
  }, [])

  const handlePaste = useCallback(async () => {
    if (!navigator.clipboard?.read) { setExportError("剪贴板读取不可用"); return }
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"))
      if (!imageType) continue
      const blob = await item.getType(imageType)
      const dataUrl = await blobToDataUrl(blob)
      addImageLayer(dataUrl, "粘贴图片")
      return
    }
    setExportError("剪贴板里没有图片")
  }, [addImageLayer])

  const handleSaveToLibrary = useCallback(() => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl) { setExportError("画布未就绪"); return }
    setLibraryDataUrl(dataUrl)
  }, [])

  const handleBack = useCallback(() => {
    // Save layer data to node results before closing
    const layerData = getState()
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as ImageEditorResult | undefined
    useCanvasStore.getState().setNodeResult(nodeId, { ...(currentResult ?? {}), layerData })
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
        {saveStatus && <span style={{ fontSize: "0.6875rem", color: "#22C55E" }}>{saveStatus}</span>}
        <div style={{ flex: 1 }} />
        <HeaderBtn icon="content_copy" label="Copy" onClick={() => void handleCopy()} />
        <HeaderBtn icon="content_paste" label="Paste" onClick={() => void handlePaste()} />
        <HeaderBtn icon="save" label="Save" onClick={handleSave} />
        <HeaderBtn icon="file_download" label="Download" onClick={handleDownload} />
        <HeaderBtn icon="folder_open" label="素材库" onClick={handleSaveToLibrary} />
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
      {libraryDataUrl && (
        <LibrarySaveDialog
          kind="image"
          defaultTitle="图片素材"
          payload={{
            data_url: libraryDataUrl,
            mime_type: "image/png",
            source_workflow_id: workflowId,
            source_node_id: nodeId,
            plain_text: "Image Editor export",
          }}
          onClose={() => setLibraryDataUrl(null)}
        />
      )}
    </div>
  )
}

function HeaderBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.375rem 0.625rem", borderRadius: "0.375rem",
      border: "1px solid var(--border-color)", background: "var(--bg-surface)",
      color: "var(--text-primary)", fontSize: "0.75rem", cursor: "pointer",
      display: "flex", alignItems: "center", gap: "0.25rem",
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
      {label}
    </button>
  )
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",")
  const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/png"
  const bytes = atob(data)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i)
  return new Blob([buffer], { type: mime })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
