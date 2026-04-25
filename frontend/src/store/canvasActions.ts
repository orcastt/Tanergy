import type { Node, Edge } from "@xyflow/react"

type CanvasState = {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
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
  const nodeIds = s.selectedNodeIds
  const edgeIds = s.selectedEdgeIds
  if (nodeIds.length === 0 && edgeIds.length === 0) return {}
  const nodes = nodeIds.length > 0 ? s.nodes.filter((n) => !nodeIds.includes(n.id)) : s.nodes
  const edges = s.edges.filter((e) => {
    if (edgeIds.includes(e.id)) return false
    if (nodeIds.includes(e.source) || nodeIds.includes(e.target)) return false
    return true
  })
  const hist = pushHistory(s)
  s.onDirty?.()
  return { nodes, edges, selectedNodeIds: [], selectedEdgeIds: [], ...hist }
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

export function splitOutlineImpl(
  s: CanvasState,
  outlineNodeId: string,
  outlinePos: { x: number; y: number },
  sections: Array<{ id: string; title: string; content: string }>,
  imagePlans?: unknown[],
): Partial<CanvasState> {
  if (!sections.length) return {}

  const W = 256, H = 160, GAP_Y = 16
  const startX = outlinePos.x + W + 80
  const startY = outlinePos.y

  // Create N text_input nodes pre-filled with section content
  const textNodes: Node[] = sections.map((sec, i) => ({
    id: crypto.randomUUID(),
    type: "text_input",
    position: { x: startX, y: startY + i * (H + GAP_Y) },
    data: { nodeType: "text_input", text: sec.content },
    selected: true,
  }))

  // Edges: outline.section_${i+1} → text_input[i].in (visual connection, text_input runs with pre-filled content)
  const outlineToTextEdges: Edge[] = textNodes.map((textNode, i) => ({
    id: `e-${outlineNodeId}-section_${i + 1}-${textNode.id}-in`,
    source: outlineNodeId,
    sourceHandle: `section_${i + 1}`,
    target: textNode.id,
    targetHandle: "in",
  } as Edge))

  const newNodes: Node[] = [...textNodes]
  const newEdges: Edge[] = [...outlineToTextEdges]

  // Create image_list node if there are image plans
  let ilId: string | null = null
  if (imagePlans && imagePlans.length > 0) {
    ilId = crypto.randomUUID()
    newNodes.push({
      id: ilId,
      type: "image_list",
      position: { x: startX, y: startY + sections.length * (H + GAP_Y) + 32 },
      data: { nodeType: "image_list", count: imagePlans.length, model: "minimax-image", imageInputs: ["img_in_1"] },
      selected: false,
    } as Node)
    newEdges.push({
      id: `e-${outlineNodeId}-image_plans-${ilId}-in`,
      source: outlineNodeId,
      sourceHandle: "image_plans",
      target: ilId,
      targetHandle: "in",
    } as Edge)
  }

  // Create html_formatter node if none exists on canvas
  const existingFormatter = s.nodes.find((n) => n.type === "html_formatter")
  if (!existingFormatter) {
    const fmtId = crypto.randomUUID()
    const fmtX = startX + W + 80
    const fmtY = startY + Math.floor(sections.length / 2) * (H + GAP_Y)
    const textInputPorts = textNodes.map((_, i) => `text_${i + 1}`)

    newNodes.push({
      id: fmtId,
      type: "html_formatter",
      position: { x: fmtX, y: fmtY },
      data: {
        nodeType: "html_formatter",
        style: "经典",
        fontSize: 16,
        lineHeight: 1.75,
        textInputs: textInputPorts,
        imageInputs: ["images"],
      },
      selected: false,
    } as Node)

    // Connect each text_input.out → html_formatter.text_N
    textNodes.forEach((textNode, i) => {
      newEdges.push({
        id: `e-${textNode.id}-out-${fmtId}-text_${i + 1}`,
        source: textNode.id,
        sourceHandle: "out",
        target: fmtId,
        targetHandle: `text_${i + 1}`,
      } as Edge)
    })

    // Connect image_list.out → html_formatter.images
    if (ilId) {
      newEdges.push({
        id: `e-${ilId}-out-${fmtId}-images`,
        source: ilId,
        sourceHandle: "out",
        target: fmtId,
        targetHandle: "images",
      } as Edge)
    }
  }

  const hist = pushHistory(s)
  s.onDirty?.()
  return {
    nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
    edges: [...s.edges, ...newEdges],
    selectedNodeIds: textNodes.map((n) => n.id),
    ...hist,
  }
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
