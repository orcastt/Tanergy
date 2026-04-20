import { Handle, Position, type NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import type { PortType } from "../types/node"
import { PORT_COLORS } from "../types/node"

interface PromptData {
  prompt: string
  [key: string]: unknown
}

export default function PromptNode({ data, selected }: NodeProps) {
  const d = data as unknown as PromptData

  return (
    <NodeBase
      title="Prompt"
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>edit_note</span>}
      inputs={[]}
      outputs={[{ id: "out", type: "prompt" as PortType, label: "Prompt" }]}
      selected={selected}
    >
      <div>
        <label style={{ fontSize: "11px", color: "#444748", display: "block", marginBottom: "0.25rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Prompt
        </label>
        <textarea
          value={d.prompt || ""}
          onChange={(e) => { d.prompt = e.target.value }}
          placeholder="Enter your prompt..."
          rows={3}
          style={{
            width: "100%", background: "transparent", border: "none",
            borderBottom: "1px solid rgba(0,0,0,0.1)", borderRadius: 0,
            padding: "0.375rem 0", fontSize: "0.875rem", color: "#0e0f0f",
            outline: "none", resize: "none", fontFamily: '"Inter", sans-serif',
          }}
        />
      </div>
    </NodeBase>
  )
}
