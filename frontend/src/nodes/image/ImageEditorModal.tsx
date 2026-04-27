import { useCallback, useMemo, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
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
import { editorColors, editorShadows, editorTypography, iconButtonStyle, primaryButtonStyle, secondaryButtonStyle } from "../../styles/editorDesign"

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
  const { t } = useTranslation()
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const result = useCanvasStore((s) => s.nodeResults[nodeId]) as ImageEditorResult | undefined
  const nodeData = node?.data as Record<string, unknown> | undefined
  const nodeType = nodeData?.nodeType
  const filePath = typeof nodeData?.filePath === "string" ? nodeData.filePath : ""
  const libraryItemId = typeof nodeData?.libraryItemId === "string" ? nodeData.libraryItemId : nodeId
  const title = typeof nodeData?.title === "string" ? nodeData.title : t("image_editor.libraryImage")
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
    if (!dataUrl) { setExportError(t("image_editor.canvasNotReady")); return }

    const newImage: ImageItem = {
      id: `export_${Date.now()}`,
      plan_id: "export",
      file_path: dataUrl,
      prompt: "Canvas export",
      description: t("image_editor.exportImage"),
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
      useCanvasStore.getState().updateNodeData(nodeId, { filePath: dataUrl, description: t("image_editor.exportImage") })
    }
    setExportError(null)
    if (closeAfter) onClose()
  }, [getState, nodeId, nodeType, onClose, t])

  const handleExport = useCallback(() => doExport(true), [doExport])
  const handleExportToNode = useCallback(() => doExport(false), [doExport])

  const handleSave = useCallback(() => {
    const layerData = getState()
    const currentResult = useCanvasStore.getState().nodeResults[nodeId] as ImageEditorResult | undefined
    useCanvasStore.getState().setNodeResult(nodeId, { ...(currentResult ?? {}), layerData, images })
    setSaveStatus(t("image_editor.saved"))
    setTimeout(() => setSaveStatus(""), 1500)
  }, [getState, images, nodeId, t])

  const handleDownload = useCallback(() => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl) { setExportError(t("image_editor.canvasNotReady")); return }
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `tanvas-image-${Date.now()}.png`
    link.click()
  }, [t])

  const handleCopy = useCallback(async () => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl || !navigator.clipboard?.write) { setExportError(t("image_editor.clipboardUnavailable")); return }
    const blob = dataUrlToBlob(dataUrl)
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    setSaveStatus(t("image_editor.copiedImage"))
    setTimeout(() => setSaveStatus(""), 1500)
  }, [t])

  const handlePaste = useCallback(async () => {
    if (!navigator.clipboard?.read) { setExportError(t("image_editor.clipboardReadUnavailable")); return }
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"))
      if (!imageType) continue
      const blob = await item.getType(imageType)
      const dataUrl = await blobToDataUrl(blob)
      addImageLayer(dataUrl, t("image_editor.pastedImage"))
      return
    }
    setExportError(t("image_editor.noClipboardImage"))
  }, [addImageLayer, t])

  const handleSaveToLibrary = useCallback(() => {
    const dataUrl = rasterizeLayers() ?? captureCanvasDisplay()
    if (!dataUrl) { setExportError(t("image_editor.canvasNotReady")); return }
    setLibraryDataUrl(dataUrl)
  }, [t])

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
    addImageLayer(dataUrl, t("image_editor.aiGenerated"))
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", flexDirection: "column",
      background: editorColors.canvas, pointerEvents: "auto",
    }}>
      <div style={{
        padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
        boxShadow: editorShadows.insetBottom, flexShrink: 0, height: 56,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
      }}>
        <button onClick={handleBack} style={iconButtonStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
        </button>
        <span style={{ ...editorTypography.title, fontSize: "1rem", color: "var(--text-primary)" }}>{t("image_editor.title")}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {t("image_editor.imageCount", { count: images.length })}
        </span>
        {exportError && (
          <span style={{ fontSize: "0.6875rem", color: editorColors.danger }}>{t("image_editor.exportFailed", { error: exportError })}</span>
        )}
        {saveStatus && <span style={{ fontSize: "0.6875rem", color: editorColors.success }}>{saveStatus}</span>}
        <div style={{ flex: 1 }} />
        <HeaderBtn icon="content_copy" label={t("image_editor.copy")} onClick={() => void handleCopy()} />
        <HeaderBtn icon="content_paste" label={t("image_editor.paste")} onClick={() => void handlePaste()} />
        <HeaderBtn icon="save" label={t("common.save")} onClick={handleSave} />
        <HeaderBtn icon="file_download" label={t("image_editor.download")} onClick={handleDownload} />
        <HeaderBtn icon="folder_open" label={t("image_editor.saveToLibrary")} onClick={handleSaveToLibrary} />
        <button onClick={handleRasterize} style={{
          ...secondaryButtonStyle,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>layers</span>
          {t("image_editor.rasterize")}
        </button>
        <button onClick={handleExport} style={{
          ...primaryButtonStyle,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
          {t("image_editor.exportToNode")}
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
          defaultTitle={t("image_editor.libraryDefaultTitle")}
          payload={{
            data_url: libraryDataUrl,
            mime_type: "image/png",
            source_workflow_id: workflowId,
            source_node_id: nodeId,
            plain_text: t("image_editor.libraryPlainText"),
          }}
          onClose={() => setLibraryDataUrl(null)}
        />
      )}
    </div>
  )
}

function HeaderBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={secondaryButtonStyle}>
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
