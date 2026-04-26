import type { Edge, Node } from "@xyflow/react"
import type { MenuItem } from "./ContextMenu"

interface BuildCanvasContextMenuParams {
  ctxNodeId?: string
  nodes: Node[]
  clipboard: unknown
  selectedCount: number
  canUndo: () => boolean
  undo: () => void
  copySelected: () => void
  pasteNodes: () => void
  deleteSelected: () => void
  groupSelected: () => void
  ungroupSelected: () => void
  setSelectedNodes: (ids: string[]) => void
  setGraphFromJson: (graph: { nodes: Node[]; edges: Edge[] }) => void
  getGraphJson: () => unknown
}

export function buildCanvasContextMenuItems(params: BuildCanvasContextMenuParams): MenuItem[] {
  const {
    ctxNodeId, nodes, clipboard, selectedCount, canUndo, undo, copySelected,
    pasteNodes, deleteSelected, groupSelected, ungroupSelected,
    setSelectedNodes, setGraphFromJson, getGraphJson,
  } = params

  if (ctxNodeId) {
    const isGroupNode = nodes.find((node) => node.id === ctxNodeId)?.type === "group"
    return [
      { label: "复制", shortcut: "⌘C", action: () => { setSelectedNodes([ctxNodeId]); copySelected() } },
      ...(clipboard ? [{ label: "粘贴", shortcut: "⌘V", action: pasteNodes }] : []),
      ...(selectedCount >= 2 && !isGroupNode ? [{ label: "打组", shortcut: "G", action: () => { setSelectedNodes([ctxNodeId]); groupSelected() } }] : []),
      ...(isGroupNode ? [{ label: "取消打组", shortcut: "G", action: () => { setSelectedNodes([ctxNodeId]); ungroupSelected() } }] : []),
      { label: "删除", shortcut: "Del", action: () => { setSelectedNodes([ctxNodeId]); deleteSelected() } },
    ]
  }

  return [
    { label: "撤销", shortcut: "⌘Z", action: () => { if (canUndo()) undo() } },
    { label: "导出 JSON", shortcut: "", action: () => exportGraph(getGraphJson()) },
    { label: "清除画布", shortcut: "", action: () => { setGraphFromJson({ nodes: [], edges: [] }) } },
    ...(clipboard ? [{ label: "粘贴", shortcut: "⌘V", action: pasteNodes }] : []),
  ]
}

function exportGraph(graph: unknown) {
  const json = JSON.stringify(graph, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "canvas.json"
  anchor.click()
  URL.revokeObjectURL(url)
}
