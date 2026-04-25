import { useEffect, useMemo } from "react"
import type { NodeProps } from "@xyflow/react"
import NodeBase from "./base/NodeBase"
import type { PortDef } from "./base/NodeBase"
import { NODE_MAP } from "./nodeDefs"
import { useCanvasStore } from "../store/canvasStore"
import { useCreditsStore } from "../store/creditsStore"
import { NODE_CREDIT_COSTS } from "../types/credits"
import ModelSelector from "../components/ModelSelector"
import { runSingleNode } from "../lib/executionEngine"
import type { PortType } from "../types/node"

interface OutlineSection {
  id: string
  title: string
  content: string
}

interface OutlineData {
  nodeType: string
  style: string
  model?: string
  promptOverride?: string
  splitCount?: number       // set after split — disables button while > 0
  splitSections?: number    // number of sections when last split ran
}

interface OutlineResult {
  sections?: OutlineSection[]
  image_plans?: unknown[]
  options?: unknown[]
  raw?: string
}

const STYLES = ["干货清单", "故事叙事", "深度分析"]

export default function OutlineGeneratorNode({ data, id, selected }: NodeProps) {
  const d = data as unknown as OutlineData
  const def = NODE_MAP[d.nodeType]
  if (!def) return null

  const { isLoggedIn } = useCreditsStore()
  const creditCost = NODE_CREDIT_COSTS[d.nodeType] ?? 0

  const { nodeStatuses, nodeResults, updateNodeData, splitOutline, nodes } = useCanvasStore()
  const status = nodeStatuses[id] ?? "idle"
  const result = nodeResults[id] as OutlineResult | undefined

  const sections = result?.sections ?? []
  const imagePlans = result?.image_plans as unknown[] | undefined

  // Auto-split when outline completes (Agent mode: no manual split needed)
  useEffect(() => {
    if (status === "done" && sections.length > 0 && !d.splitCount) {
      const outlineNode = nodes.find((n) => n.id === id)
      if (outlineNode) {
        splitOutline(id, outlineNode.position, sections, imagePlans)
        updateNodeData(id, { splitCount: sections.length })
        // Auto-run newly created text_input nodes
        setTimeout(() => {
          const { selectedNodeIds } = useCanvasStore.getState()
          selectedNodeIds.forEach((nodeId) => {
            runSingleNode(nodeId).catch(console.error)
          })
        }, 100)
      }
    }
  }, [status])

  // Clear splitCount when outline is re-run so Split button re-enables
  useEffect(() => {
    if (status === "running" && d.splitCount != null) {
      updateNodeData(id, { splitCount: undefined })
    }
  }, [status])

  // Re-enable Split button if outline is re-run (splitCount cleared when nodeData changes from outside)
  const isSplitDone = d.splitCount != null && d.splitCount > 0

  function handleSplit() {
    if (!sections.length) return
    const outlineNode = nodes.find((n) => n.id === id)
    if (!outlineNode) return
    splitOutline(id, outlineNode.position, sections, imagePlans)
    updateNodeData(id, { splitCount: sections.length })
    // Auto-run newly created text_input nodes
    const { selectedNodeIds } = useCanvasStore.getState()
    selectedNodeIds.forEach((nodeId) => {
      runSingleNode(nodeId).catch(console.error)
    })
  }

  // Build dynamic outputs: section ports first (top to bottom), image_plans last
  const outputs: PortDef[] = useMemo(() => {
    // section_1, section_2, ... (no label = hidden from bottom bar bar)
    const sectionPorts: PortDef[] = sections.map((_section, i) => ({
      id: `section_${i + 1}`,
      type: "text" as PortType,
    }))
    // image_plans at the bottom
    const imagePlansPort: PortDef[] = [
      { id: "image_plans", type: "image_plans" as PortType, label: "Images" },
    ]
    return [...sectionPorts, ...imagePlansPort]
  }, [sections.length])

  return (
    <NodeBase
      title={def.label}
      category={def.category}
      icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#5e5e5e" }}>format_list_bulleted</span>}
      inputs={def.inputs}
      outputs={outputs}
      status={status}
      selected={selected}
      nodeId={id}
      creditCost={isLoggedIn ? creditCost : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>Model:</span>
        <ModelSelector
          category="text"
          value={d.model}
          onChange={(model) => updateNodeData(id, { model })}
        />
      </div>

      {/* Style chips */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => updateNodeData(id, { style: s })}
            className="nodrag nopan"
            style={{
              padding: "0.25rem 0.5rem", fontSize: "0.6875rem", borderRadius: "9999px",
              border: d.style === s ? "1px solid #7C3AED" : "1px solid var(--border-color)",
              background: d.style === s ? "#f5f3ff" : "transparent",
              color: d.style === s ? "#7C3AED" : "var(--text-secondary)",
              cursor: "pointer", fontWeight: d.style === s ? 600 : 400,
            }}
          >{s}</button>
        ))}
      </div>

      {/* Custom prompt override — shown when idle */}
      {status === "idle" && (
        <textarea
          value={d.promptOverride ?? ""}
          onChange={(e) => updateNodeData(id, { promptOverride: e.target.value })}
          placeholder="附加要求（可选）：如「重点突出数据」「加入案例故事」..."
          className="nodrag nopan"
          style={{
            width: "100%", height: "52px", fontSize: "0.6875rem", resize: "none",
            border: "1px solid var(--border-color)", borderRadius: "0.375rem",
            padding: "0.375rem 0.5rem", background: "var(--bg-input)",
            color: "var(--text-primary)", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
      )}

      {status === "running" && (
        <div style={{
          padding: "0.5rem", background: "#eff6ff", borderRadius: "0.25rem",
          fontSize: "0.75rem", color: "#1d4ed8",
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", animation: "spin 1s linear infinite" }}>progress_activity</span>
          正在生成大纲...
        </div>
      )}

      {/* Sections preview + Split button — done state */}
      {status === "done" && sections.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
            <button
              onClick={handleSplit}
              disabled={isSplitDone}
              className="nodrag nopan"
              style={{
                padding: "0.25rem 0.625rem", fontSize: "0.6875rem", fontWeight: 600,
                background: isSplitDone ? "#9ca3af" : "#6349EA",
                color: "#fff", border: "none",
                borderRadius: "9999px", cursor: isSplitDone ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "0.25rem",
                opacity: isSplitDone ? 0.6 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>call_split</span>
              Split ({sections.length})
            </button>
          </div>
          {sections.map((sec) => (
            <div key={sec.id} style={{
              padding: "0.375rem 0.5rem", background: "#f5f3ff",
              borderRadius: "0.375rem", border: "1px solid #ede9fe",
              marginBottom: "0.25rem",
            }}>
              <div style={{ fontWeight: 600, color: "#6d28d9", fontSize: "0.6875rem" }}>
                [{sec.id}] {sec.title}
              </div>
              <div style={{ fontSize: "0.625rem", color: "#6b7280", marginTop: "0.125rem" }}>
                {sec.content.slice(0, 80)}{sec.content.length > 80 ? "..." : ""}
              </div>
            </div>
          ))}
          {imagePlans && imagePlans.length > 0 && (
            <div style={{ fontSize: "0.625rem", color: "#9ca3af", marginTop: "0.125rem" }}>
              {imagePlans.length} 张配图计划已生成
            </div>
          )}
        </>
      )}

      {status === "error" && (
        <div style={{
          padding: "0.375rem 0.5rem", background: "#fef2f2",
          borderRadius: "0.25rem", fontSize: "0.6875rem", color: "#991b1b",
        }}>
          执行失败，请检查 API Key
        </div>
      )}
    </NodeBase>
  )
}
