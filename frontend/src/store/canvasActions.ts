import type { Node, Edge } from "@xyflow/react"

type CanvasState = {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  clipboard: { nodes: Node[]; edges: Edge[] } | null
  history: { nodes: Node[]; edges: Edge[] }[]
  historyIndex: number
  maxHistory: number
  onDirty?: () => void
}

export function pushHistory(state: CanvasState): Partial<CanvasState> {
  const truncated = state.history.slice(0, state.historyIndex + 1)
  const snapshot = {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  }
  const newHistory = [...truncated, snapshot]
  if (newHistory.length > state.maxHistory) newHistory.shift()
  return { history: newHistory, historyIndex: newHistory.length - 1 }
}

export function copySelectedImpl(s: CanvasState) {
  const ids = s.selectedNodeIds
  if (ids.length === 0) return null
  const copiedNodes = s.nodes.filter((n) => ids.includes(n.id)).map((n) => JSON.parse(JSON.stringify(n)))
  const copiedEdges = s.edges.filter((e) => ids.includes(e.source) && ids.includes(e.target)).map((e) => JSON.parse(JSON.stringify(e)))
  return { clipboard: { nodes: copiedNodes, edges: copiedEdges } }
}

export function pasteNodesImpl(s: CanvasState): Partial<CanvasState> {
  const clip = s.clipboard
  if (!clip || clip.nodes.length === 0) return {}
  const idMap: Record<string, string> = {}
  const newNodes = clip.nodes.map((n) => {
    const newId = crypto.randomUUID()
    idMap[n.id] = newId
    return { ...JSON.parse(JSON.stringify(n)), id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true }
  })
  const newEdges = clip.edges.map((e) => ({
    ...JSON.parse(JSON.stringify(e)),
    id: `e-${idMap[e.source]}-${e.sourceHandle}-${idMap[e.target]}-${e.targetHandle}`,
    source: idMap[e.source], target: idMap[e.target],
  }))
  const nodes = s.nodes.map((n) => ({ ...n, selected: false })).concat(newNodes)
  const edges = s.edges.concat(newEdges)
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, edges, selectedNodeIds: newNodes.map((n) => n.id), ...hist }
}

export function deleteSelectedImpl(s: CanvasState): Partial<CanvasState> {
  const ids = s.selectedNodeIds
  if (ids.length === 0) return {}
  const nodes = s.nodes.filter((n) => !ids.includes(n.id))
  const edges = s.edges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target))
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, edges, selectedNodeIds: [], ...hist }
}

export function duplicateNodeImpl(s: CanvasState, id: string): Partial<CanvasState> {
  const node = s.nodes.find((n) => n.id === id)
  if (!node) return {}
  const newId = crypto.randomUUID()
  const newNode = { ...JSON.parse(JSON.stringify(node)), id: newId, position: { x: node.position.x + 40, y: node.position.y + 40 }, selected: true }
  const nodes = s.nodes.map((n) => ({ ...n, selected: false })).concat(newNode)
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, selectedNodeIds: [newId], ...hist }
}

export function groupSelectedImpl(s: CanvasState): Partial<CanvasState> {
  const ids = s.selectedNodeIds
  if (ids.length < 2) return {}
  const childNodes = s.nodes.filter((n) => ids.includes(n.id))
  if (childNodes.length === 0) return {}
  const minX = Math.min(...childNodes.map((n) => n.position.x))
  const minY = Math.min(...childNodes.map((n) => n.position.y))
  const maxX = Math.max(...childNodes.map((n) => n.position.x + (n.width || 200)))
  const maxY = Math.max(...childNodes.map((n) => n.position.y + (n.height || 100)))
  const groupId = crypto.randomUUID()
  const groupNode: Node = {
    id: groupId, type: "group",
    position: { x: minX - 20, y: minY - 40 },
    style: { width: maxX - minX + 40, height: maxY - minY + 60 },
    data: { nodeType: "group", label: "Group", color: "#6349EA" },
    selectable: true,
  }
  const updatedChildren = childNodes.map((n) => ({
    ...n,
    position: { x: n.position.x - groupNode.position.x, y: n.position.y - groupNode.position.y },
    parentId: groupId, extent: "parent" as const,
  }))
  const otherNodes = s.nodes.filter((n) => !ids.includes(n.id))
  const nodes = [...otherNodes, ...updatedChildren, groupNode]
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, selectedNodeIds: [groupId], ...hist }
}

export function ungroupSelectedImpl(s: CanvasState): Partial<CanvasState> {
  const ids = s.selectedNodeIds
  const groups = s.nodes.filter((n) => ids.includes(n.id) && n.type === "group")
  if (groups.length === 0) return {}
  const groupIds = new Set(groups.map((g) => g.id))
  const children = s.nodes.filter((n) => groupIds.has(n.parentId ?? ""))
  const restored = children.map((n) => {
    const parent = groups.find((g) => g.id === n.parentId)!
    return { ...n, position: { x: n.position.x + parent.position.x, y: n.position.y + parent.position.y }, parentId: undefined, extent: undefined }
  })
  const nodes = [...s.nodes.filter((n) => !groupIds.has(n.id) && !groupIds.has(n.parentId ?? "")), ...restored]
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, selectedNodeIds: restored.map((n) => n.id), ...hist }
}
