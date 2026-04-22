import { useState } from "react"
import ImageEditorPanel from "./ImageEditorPanel"
import DrawingPanel from "./DrawingPanel"
import { useCanvasStore } from "../../store/canvasStore"
import { useDrawingStore } from "./drawingStore"

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
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectedImage = images[selectedIndex] ?? null

  function handleAiEdit(instruction: string) {
    // TODO: call image edit API with drawing + instruction
    console.log("AI Edit:", instruction, "on image:", selectedImage?.file_path)
    // For now, placeholder — will be wired to Rust backend in next iteration
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        width: "900px", height: "600px", background: "var(--bg-surface)",
        borderRadius: "0.75rem", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--border-color)", flexShrink: 0,
        }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Image Editor</span>
          <button onClick={onClose} style={{
            width: "28px", height: "28px", borderRadius: "0.375rem", border: "none",
            background: "var(--bg-hover)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>

        {/* Body — left: image list, right: canvas */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left panel — image list */}
          <div style={{
            width: "160px", borderRight: "1px solid var(--border-color)", flexShrink: 0,
            background: "var(--bg-canvas)",
          }}>
            <ImageEditorPanel images={images} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
          </div>

          {/* Right panel — drawing canvas */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <DrawingPanel image={selectedImage} onAiEdit={handleAiEdit} />
          </div>
        </div>
      </div>
    </div>
  )
}
