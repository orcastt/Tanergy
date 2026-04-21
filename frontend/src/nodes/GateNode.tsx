import { useState } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"

interface GateData {
  nodeType: string
  mode: "select" | "input"
  title: string
}

export default function GateNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as GateData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { nodeStatuses, nodeResults, waitingGates, updateNodeData, resolveGate } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as { selected?: string } | undefined
  const waitingOptions = waitingGates[id]

  function handleSelect(option: string) {
    resolveGate(id, option)
  }

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>fork_right</span>}
      inputs={def.inputs}
      outputs={def.outputs}
      status={status}
      selected={selected}
      nodeId={id}
    >
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.375rem" }}>
        <button
          onClick={() => updateNodeData(id, { mode: "select" })}
          style={{
            flex: 1, padding: "0.25rem", fontSize: "0.6875rem",
            border: d.mode !== "input" ? "1px solid #F59E0B" : "1px solid #e3e2e2",
            background: d.mode !== "input" ? "#fffbeb" : "#ffffff",
            color: d.mode !== "input" ? "#92400e" : "#747878",
            borderRadius: "0.25rem", cursor: "pointer", fontWeight: 600,
          }}
        >
          选择
        </button>
        <button
          onClick={() => updateNodeData(id, { mode: "input" })}
          style={{
            flex: 1, padding: "0.25rem", fontSize: "0.6875rem",
            border: d.mode === "input" ? "1px solid #F59E0B" : "1px solid #e3e2e2",
            background: d.mode === "input" ? "#fffbeb" : "#ffffff",
            color: d.mode === "input" ? "#92400e" : "#747878",
            borderRadius: "0.25rem", cursor: "pointer", fontWeight: 600,
          }}
        >
          输入
        </button>
      </div>

      {/* Waiting state — show options for user to select */}
      {status === "waiting" && waitingOptions && d.mode !== "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontSize: "0.6875rem", color: "#92400e", fontWeight: 600 }}>
            ⏸ 请选择方向：
          </div>
          {waitingOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              style={{
                padding: "0.375rem 0.5rem",
                fontSize: "0.6875rem",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "0.25rem",
                cursor: "pointer",
                textAlign: "left",
                color: "#1b1c1c",
                lineHeight: 1.4,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Waiting state — input mode */}
      {status === "waiting" && d.mode === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontSize: "0.6875rem", color: "#92400e", fontWeight: 600 }}>
            ⏸ 等待你输入素材...
          </div>
          <GateInputBox nodeId={id} />
        </div>
      )}

      {/* Done state */}
      {status === "done" && result?.selected && (
        <div style={{
          padding: "0.375rem 0.5rem",
          background: "#f0fdf4",
          borderRadius: "0.25rem",
          fontSize: "0.6875rem",
          color: "#166534",
        }}>
          ✓ 已选：{typeof result.selected === "string"
            ? result.selected.slice(0, 50) + (result.selected.length > 50 ? "..." : "")
            : "已完成"}
        </div>
      )}

      {/* Idle */}
      {status === "idle" && (
        <div style={{ fontSize: "0.6875rem", color: "#747878", textAlign: "center" }}>
          等待上游数据...
        </div>
      )}
    </NodeBase>
  )
}

function GateInputBox({ nodeId }: { nodeId: string }) {
  const [text, setText] = useState("")
  const resolveGate = useCanvasStore((s) => s.resolveGate)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="在这里粘贴你的素材..."
        style={{
          width: "100%", minHeight: "60px",
          border: "1px solid #fde68a", borderRadius: "0.25rem",
          padding: "0.375rem", fontSize: "0.75rem",
          resize: "vertical", outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
      <button
        onClick={() => { if (text.trim()) resolveGate(nodeId, text.trim()) }}
        style={{
          padding: "0.25rem 0.5rem", fontSize: "0.6875rem",
          background: "#F59E0B", color: "#ffffff",
          border: "none", borderRadius: "0.25rem",
          cursor: "pointer", fontWeight: 600,
        }}
      >
        确认提交 →
      </button>
    </div>
  )
}
