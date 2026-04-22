import type { ReactNode } from "react"
import { Handle, Position } from "@xyflow/react"
import type { PortType } from "../../types/node"
import { PORT_COLORS } from "../../types/node"
import NodeTitle from "./NodeTitle"
import NodeRunButton from "./NodeRunButton"

type Status = "idle" | "running" | "waiting" | "done" | "error"

const CATEGORY_COLORS: Record<string, string> = {
  input: "#3B82F6",
  text: "#92400E",
  ai: "#6349EA",
  image: "#22C55E",
  output: "#EAB308",
}

export interface PortDef {
  id: string
  type: PortType
  label?: string
}

interface Props {
  title: string
  icon?: ReactNode
  inputs?: PortDef[]
  outputs?: PortDef[]
  status?: Status
  selected?: boolean
  nodeId?: string
  category?: string
  creditCost?: number
  children?: ReactNode
}

export default function NodeBase({ title, icon, inputs = [], outputs = [], status, selected, nodeId, category, creditCost, children }: Props) {
  const ringStyle = selected
    ? "0 0 0 2px #242424, 0 4px 6px -1px rgba(0,0,0,0.1)"
    : status === "running"
    ? "0 0 0 2px #3B82F6, 0 4px 12px rgba(59,130,246,0.2)"
    : status === "waiting"
    ? "0 0 0 2px #F59E0B, 0 4px 12px rgba(245,158,11,0.2)"
    : status === "done"
    ? "0 0 0 2px #22C55E, 0 2px 8px rgba(34,197,94,0.15)"
    : status === "error"
    ? "0 0 0 2px #EF4444, 0 4px 12px rgba(239,68,68,0.2)"
    : "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)"

  const inputCount = inputs.length
  const outputCount = outputs.length

  return (
    <div style={{
      width: "256px",
      background: "#ffffff",
      borderRadius: "0.5rem",
      boxShadow: ringStyle,
      overflow: "visible",
      position: "relative",
      transition: "box-shadow 200ms ease",
      borderLeft: category ? `3px solid ${CATEGORY_COLORS[category] ?? "#747878"}` : undefined,
    }}>
      {/* Input handles */}
      {inputs.map((port, i) => (
        <div key={port.id} title={`Input: ${port.type}`} style={{ position: "absolute", left: 0, top: inputCount === 1 ? "50%" : `${30 + (i / (inputCount - 1)) * 40}%`, transform: "translate(-50%, -50%)", zIndex: 10 }}>
          <Handle
            type="target"
            position={Position.Left}
            id={port.id}
            style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: PORT_COLORS[port.type],
              border: "none",
              position: "relative",
              transition: "transform 150ms ease",
            }}
          />
        </div>
      ))}

      {/* Output handles */}
      {outputs.map((port, i) => (
        <div key={port.id} title={`Output: ${port.type}`} style={{ position: "absolute", right: 0, top: outputCount === 1 ? "50%" : `${30 + (i / (outputCount - 1)) * 40}%`, transform: "translate(50%, -50%)", zIndex: 10 }}>
          <Handle
            type="source"
            position={Position.Right}
            id={port.id}
            style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: PORT_COLORS[port.type],
              border: "none",
              position: "relative",
              transition: "transform 150ms ease",
            }}
          />
        </div>
      ))}

      <NodeTitle icon={icon} title={title} status={status} footer={
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {creditCost != null && creditCost > 0 && (
            <div style={{
              fontSize: "0.5625rem", color: "#6349EA", display: "flex",
              alignItems: "center", gap: "0.125rem", padding: "0 0.25rem",
              background: "#f5f3ff", borderRadius: "0.25rem",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>bolt</span>
              {creditCost}
            </div>
          )}
          {nodeId ? <NodeRunButton nodeId={nodeId} status={status ?? "idle"} /> : undefined}
        </div>
      } />

      {children && (
        <div style={{ padding: "1rem" }}>
          {children}
        </div>
      )}

      {(inputs.length > 0 || outputs.length > 0) && (
        <div style={{
          padding: "0.5rem",
          borderTop: "1px solid #efeded",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            {inputs.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {p.label && <span style={{ fontSize: "10px", color: "#747878" }}>{p.label}</span>}
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PORT_COLORS[p.type] }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            {outputs.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {p.label && <span style={{ fontSize: "10px", color: "#747878" }}>{p.label}</span>}
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PORT_COLORS[p.type] }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
