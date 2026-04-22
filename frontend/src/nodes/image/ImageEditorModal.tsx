import { useState } from "react"
import ImageEditorPanel from "./ImageEditorPanel"
import DrawingPanel from "./DrawingPanel"
import { useCanvasStore } from "../../store/canvasStore"

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
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", flexDirection: "column",
      background: "var(--bg-surface)",
    }}>
      {/* Header with back button */}
      <div style={{
        padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
        borderBottom: "1px solid var(--border-color)", flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
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
      </div>

      {/* Body — left: image list, right: canvas */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left panel — image list */}
        <div style={{
          width: "200px", borderRight: "1px solid var(--border-color)", flexShrink: 0,
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
  )
}
