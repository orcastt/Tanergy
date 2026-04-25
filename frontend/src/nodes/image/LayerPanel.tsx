import { useState } from "react"
import { useLayerStore } from "./layerStore"

interface Props {
  onExportLayer?: () => void
}

export default function LayerPanel({ onExportLayer }: Props) {
  const {
    layers, activeLayerId,
    setOpacity,
    addLayer, removeLayer, duplicateLayer, moveLayer, moveTo,
  } = useLayerStore()

  const [draggingId, setDraggingId] = useState<string | null>(null)

  const activeLayer = layers.find((l) => l.id === activeLayerId)

  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDrop(targetVisualIndex: number) {
    if (!draggingId) return
    // Convert visual index back to actual array index
    // visual index 0 (top) = layers[length-1], visual 1 = layers[length-2]
    const toIndex = layers.length - 1 - targetVisualIndex
    moveTo(draggingId, toIndex)
    setDraggingId(null)
  }

  return (
    <div style={{
      width: "220px", borderLeft: "1px solid var(--border-color)", flexShrink: 0,
      background: "var(--bg-canvas)", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border-color)",
        fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: "0.375rem",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>layers</span>
        图层 ({layers.length})
      </div>

      {/* Layer list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.375rem" }}>
        {[...layers].reverse().map((layer, visualIdx) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            index={visualIdx}
            total={layers.length}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Active layer opacity */}
      {activeLayer && (
        <div style={{
          padding: "0.5rem 0.75rem", borderTop: "1px solid var(--border-color)",
        }}>
          <div style={{ fontSize: "0.5625rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            不透明度 {Math.round(activeLayer.opacity * 100)}%
          </div>
          <input
            type="range" min={0} max={100}
            value={Math.round(activeLayer.opacity * 100)}
            onChange={(e) => setOpacity(activeLayer.id, Number(e.target.value) / 100)}
            style={{ width: "100%", height: "4px", accentColor: "#6349EA" }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        padding: "0.5rem", borderTop: "1px solid var(--border-color)",
        display: "flex", gap: "0.25rem", flexWrap: "wrap",
      }}>
        <ActionBtn icon="add" title="新建图层" onClick={() => addLayer()} />
        <ActionBtn icon="content_copy" title="复制图层" onClick={() => activeLayerId && duplicateLayer(activeLayerId)} />
        <ActionBtn icon="delete" title="删除图层" onClick={() => activeLayerId && removeLayer(activeLayerId)} />
        <ActionBtn icon="arrow_upward" title="上移" onClick={() => activeLayerId && moveLayer(activeLayerId, "up")} />
        <ActionBtn icon="arrow_downward" title="下移" onClick={() => activeLayerId && moveLayer(activeLayerId, "down")} />
      </div>

      {/* Export to node */}
      {onExportLayer && (
        <div style={{ padding: "0.375rem 0.5rem", borderTop: "1px solid var(--border-color)" }}>
          <button
            onClick={onExportLayer}
            style={{
              width: "100%", padding: "0.375rem 0.5rem", borderRadius: "0.375rem",
              border: "1px solid #22C55E", background: "transparent",
              color: "#22C55E", fontSize: "0.6875rem", fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "0.25rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
            导出到节点输出
          </button>
        </div>
      )}
    </div>
  )
}

function LayerRow({ layer, isActive, index, total, onDragStart, onDrop }: {
  layer: { id: string; name: string; visible: boolean; locked: boolean; opacity: number; imageSrc: string | null; strokes: { points: unknown[] }[] }
  isActive: boolean
  index: number
  total: number
  onDragStart: (id: string) => void
  onDrop: (targetIndex: number) => void
}) {
  const { setActive, toggleVisible, toggleLocked } = useLayerStore()

  const icon = layer.imageSrc ? "image" : layer.strokes.length > 0 ? "brush" : "square"
  const subtitle = layer.imageSrc ? "图片" : `${layer.strokes.length} 笔`

  // Visual index = reverse of array index (top row = last in array)
  const visualIndex = total - 1 - index

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(layer.id) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(visualIndex) }}
      onClick={() => setActive(layer.id)}
      style={{
        display: "flex", alignItems: "center", gap: "0.375rem",
        padding: "0.375rem 0.5rem", borderRadius: "0.375rem", cursor: "grab",
        background: isActive ? "var(--bg-hover)" : "transparent",
        border: isActive ? "1px solid #6349EA" : "1px solid transparent",
        marginBottom: "0.125rem",
        userSelect: "none",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--text-secondary)", cursor: "grab" }}>drag_indicator</span>
      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.6875rem", color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {layer.name}
        </div>
        <div style={{ fontSize: "0.5rem", color: "var(--text-placeholder)" }}>{subtitle}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); toggleVisible(layer.id) }}
        title={layer.visible ? "隐藏" : "显示"}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: layer.visible ? "var(--text-secondary)" : "var(--text-placeholder)" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{layer.visible ? "visibility" : "visibility_off"}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); toggleLocked(layer.id) }}
        title={layer.locked ? "解锁" : "锁定"}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: layer.locked ? "#F59E0B" : "var(--text-placeholder)" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{layer.locked ? "lock" : "lock_open"}</span>
      </button>
    </div>
  )
}

function ActionBtn({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "28px", height: "28px", borderRadius: "0.375rem", border: "1px solid var(--border-color)",
        background: "var(--bg-surface)", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", color: "var(--text-secondary)",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
    </button>
  )
}
