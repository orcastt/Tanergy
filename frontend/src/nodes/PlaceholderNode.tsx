import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"

interface PlaceholderData {
  nodeType: string
  [key: string]: unknown
}

export default function PlaceholderNode({ data, selected }: NodeProps) {
  const d = data as unknown as PlaceholderData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  return (
    <NodeBase
      title={def.label}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>{def.icon}</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      selected={selected}
    >
      <div style={{
        padding: "0.5rem 0",
        fontSize: "0.75rem", color: "#747878",
        textAlign: "center",
      }}>
        {def.description}
      </div>
    </NodeBase>
  )
}
