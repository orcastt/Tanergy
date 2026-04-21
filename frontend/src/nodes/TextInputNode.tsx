import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

interface TextInputData {
  nodeType: string
  text: string
}

export default function TextInputNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as TextInputData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults, updateNodeData } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { text?: string } | undefined

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>edit_note</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      <textarea
        value={d.text ?? ""}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
        placeholder="输入主题、关键词或文章要求..."
        style={{
          width: "100%",
          minHeight: "80px",
          border: "1px solid #e3e2e2",
          borderRadius: "0.375rem",
          padding: "0.5rem",
          fontSize: "0.8125rem",
          color: "#1b1c1c",
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
          background: status === "done" ? "#f0fdf4" : "#ffffff",
        }}
      />
      {result?.text && status === "done" && (
        <div style={{
          marginTop: "0.375rem",
          padding: "0.375rem 0.5rem",
          background: "#f0fdf4",
          borderRadius: "0.25rem",
          fontSize: "0.6875rem",
          color: "#166534",
          maxHeight: "60px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          ✓ 输出就绪
        </div>
      )}
    </NodeBase>
  )
}
