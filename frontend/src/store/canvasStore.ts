import { create } from "zustand"
import type { Node, Edge } from "@xyflow/react"
import { pushHistory, copySelectedImpl, pasteNodesImpl, deleteSelectedImpl, duplicateNodeImpl, groupSelectedImpl, ungroupSelectedImpl } from "./canvasActions"

type NodeStatus = "idle" | "running" | "waiting" | "done" | "error"

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  nodeStatuses: Record<string, NodeStatus>
  nodeResults: Record<string, unknown>
  waitingGates: Record<string, string[]>
  clipboard: { nodes: Node[]; edges: Edge[] } | null
  history: { nodes: Node[]; edges: Edge[] }[]
  historyIndex: number
  maxHistory: number
  addNode: (node: Node) => void
  removeNode: (id: string) => void
  updateNodeData: (id: string, data: Record<string, unknown>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  copySelected: () => void
  pasteNodes: () => void
  deleteSelected: () => void
  duplicateNode: (id: string) => void
  groupSelected: () => void
  ungroupSelected: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  setNodeResult: (nodeId: string, result: unknown) => void
  setWaitingGate: (nodeId: string, options: string[]) => void
  resolveGate: (nodeId: string, selectedOption: string) => void
  setGraphFromJson: (graphJson: { nodes: Node[]; edges: Edge[] }) => void
  getGraphJson: () => { nodes: Node[]; edges: Edge[] }
  setSelectedNodes: (ids: string[]) => void
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onDirty?: () => void
  setOnDirty: (cb: (() => void) | undefined) => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [], edges: [], selectedNodeIds: [], selectedEdgeIds: [], nodeStatuses: {}, nodeResults: {},
  waitingGates: {}, history: [], historyIndex: -1, maxHistory: 50, clipboard: null,

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node], ...pushHistory(s) })),

  removeNode: (id) => set((s) => {
    const nodes = s.nodes.filter((n) => n.id !== id)
    const edges = s.edges.filter((e) => e.source !== id && e.target !== id)
    s.onDirty?.()
    return { nodes, edges, ...pushHistory(s) }
  }),

  updateNodeData: (id, data) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
    s.onDirty?.()
    return { nodes, ...pushHistory(s) }
  }),

  updateNodePosition: (id, position) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, position } : n)
    s.onDirty?.()
    return { nodes }
  }),

  addEdge: (edge) => set((s) => { s.onDirty?.(); return { edges: [...s.edges, edge], ...pushHistory(s) } }),
  removeEdge: (id) => set((s) => { s.onDirty?.(); return { edges: s.edges.filter((e) => e.id !== id), ...pushHistory(s) } }),

  undo: () => set((s) => {
    if (s.historyIndex <= 0) return s
    const idx = s.historyIndex - 1
    const snap = s.history[idx]
    s.onDirty?.()
    return { nodes: JSON.parse(JSON.stringify(snap.nodes)), edges: JSON.parse(JSON.stringify(snap.edges)), historyIndex: idx }
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.history.length - 1) return s
    const idx = s.historyIndex + 1
    const snap = s.history[idx]
    s.onDirty?.()
    return { nodes: JSON.parse(JSON.stringify(snap.nodes)), edges: JSON.parse(JSON.stringify(snap.edges)), historyIndex: idx }
  }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setNodeStatus: (nodeId, status) => set((s) => ({ nodeStatuses: { ...s.nodeStatuses, [nodeId]: status } })),
  setNodeResult: (nodeId, result) => set((s) => ({ nodeResults: { ...s.nodeResults, [nodeId]: result } })),

  setWaitingGate: (nodeId, options) => set((s) => ({ waitingGates: { ...s.waitingGates, [nodeId]: options } })),
  resolveGate: (nodeId, selectedOption) => set((s) => {
    const newWaitingGates = { ...s.waitingGates }
    delete newWaitingGates[nodeId]
    return { waitingGates: newWaitingGates, nodeResults: { ...s.nodeResults, [nodeId]: { selected: selectedOption } }, nodeStatuses: { ...s.nodeStatuses, [nodeId]: "done" } }
  }),

  setGraphFromJson: (graphJson) => set({ nodes: graphJson.nodes || [], edges: graphJson.edges || [], history: [], historyIndex: -1, nodeStatuses: {}, nodeResults: {} }),
  getGraphJson: () => { const s = get(); return { nodes: JSON.parse(JSON.stringify(s.nodes)), edges: JSON.parse(JSON.stringify(s.edges)) } },
  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  onNodesChange: (changes) => set((s) => {
    let nodes = s.nodes
    let selectedIds = s.selectedNodeIds
    for (const c of changes) {
      if (c.type === "position" && c.position) nodes = nodes.map((n) => n.id === c.id ? { ...n, position: c.position! } : n)
      else if (c.type === "remove") nodes = nodes.filter((n) => n.id !== c.id)
      else if (c.type === "select") {
        const id = c.id
        if (c.selected) { if (!selectedIds.includes(id)) selectedIds = [...selectedIds, id] }
        else { selectedIds = selectedIds.filter((x) => x !== id) }
        nodes = nodes.map((n) => n.id === id ? { ...n, selected: c.selected } : n)
      }
    }
    return { nodes, selectedNodeIds: selectedIds }
  }),

  onEdgesChange: (changes) => set((s) => {
    let edges = s.edges
    let selectedEdgeIds = s.selectedEdgeIds
    for (const c of changes) {
      if (c.type === "remove") edges = edges.filter((e) => e.id !== c.id)
      else if (c.type === "select") {
        if (c.selected) { if (!selectedEdgeIds.includes(c.id)) selectedEdgeIds = [...selectedEdgeIds, c.id] }
        else { selectedEdgeIds = selectedEdgeIds.filter((x) => x !== c.id) }
      }
    }
    s.onDirty?.()
    return { edges, selectedEdgeIds }
  }),

  copySelected: () => { const r = copySelectedImpl(get()); if (r) set(r) },
  pasteNodes: () => set((s) => pasteNodesImpl(s)),
  deleteSelected: () => set((s) => deleteSelectedImpl(s)),
  duplicateNode: (id) => set((s) => duplicateNodeImpl(s, id)),
  groupSelected: () => set((s) => groupSelectedImpl(s)),
  ungroupSelected: () => set((s) => ungroupSelectedImpl(s)),

  setOnDirty: (cb) => set({ onDirty: cb }),
}))
