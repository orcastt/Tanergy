import { create } from "zustand"
import type { Node, Edge } from "@xyflow/react"

interface CanvasSnapshot {
  nodes: Node[]
  edges: Edge[]
}

type NodeStatus = "idle" | "running" | "waiting" | "done" | "error"

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  nodeStatuses: Record<string, NodeStatus>
  nodeResults: Record<string, unknown>

  // Gate node waiting state
  waitingGates: Record<string, string[]>  // gateNodeId → option labels

  history: CanvasSnapshot[]
  historyIndex: number
  maxHistory: number

  // Node ops
  addNode: (node: Node) => void
  removeNode: (id: string) => void
  updateNodeData: (id: string, data: Record<string, unknown>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void

  // Edge ops
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void

  // History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Status
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  setNodeResult: (nodeId: string, result: unknown) => void

  // Gate waiting
  setWaitingGate: (nodeId: string, options: string[]) => void
  resolveGate: (nodeId: string, selectedOption: string) => void

  // Bulk
  setGraphFromJson: (graphJson: { nodes: Node[]; edges: Edge[] }) => void
  getGraphJson: () => { nodes: Node[]; edges: Edge[] }

  // Selection
  setSelectedNodes: (ids: string[]) => void

  // React Flow sync
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void

  // Dirty callback
  onDirty?: () => void
  setOnDirty: (cb: (() => void) | undefined) => void
}

function pushHistory(state: CanvasState): Partial<CanvasState> {
  const truncated = state.history.slice(0, state.historyIndex + 1)
  const snapshot: CanvasSnapshot = {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  }
  const newHistory = [...truncated, snapshot]
  if (newHistory.length > state.maxHistory) newHistory.shift()
  return { history: newHistory, historyIndex: newHistory.length - 1 }
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  nodeStatuses: {},
  nodeResults: {},
  waitingGates: {},
  history: [],
  historyIndex: -1,
  maxHistory: 50,

  addNode: (node) => set((s) => {
    const nodes = [...s.nodes, node]
    const hist = pushHistory(s)
    return { nodes, ...hist }
  }),

  removeNode: (id) => set((s) => {
    const nodes = s.nodes.filter((n) => n.id !== id)
    const edges = s.edges.filter((e) => e.source !== id && e.target !== id)
    const hist = pushHistory(s)
    s.onDirty?.()
    return { nodes, edges, ...hist }
  }),

  updateNodeData: (id, data) => set((s) => {
    const nodes = s.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    )
    const hist = pushHistory(s)
    s.onDirty?.()
    return { nodes, ...hist }
  }),

  updateNodePosition: (id, position) => set((s) => {
    const nodes = s.nodes.map((n) =>
      n.id === id ? { ...n, position } : n
    )
    s.onDirty?.()
    return { nodes }
  }),

  addEdge: (edge) => set((s) => {
    const edges = [...s.edges, edge]
    const hist = pushHistory(s)
    s.onDirty?.()
    return { edges, ...hist }
  }),

  removeEdge: (id) => set((s) => {
    const edges = s.edges.filter((e) => e.id !== id)
    const hist = pushHistory(s)
    s.onDirty?.()
    return { edges, ...hist }
  }),

  undo: () => set((s) => {
    if (s.historyIndex <= 0) return s
    const idx = s.historyIndex - 1
    const snap = s.history[idx]
    s.onDirty?.()
    return {
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      historyIndex: idx,
    }
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.history.length - 1) return s
    const idx = s.historyIndex + 1
    const snap = s.history[idx]
    s.onDirty?.()
    return {
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      historyIndex: idx,
    }
  }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setNodeStatus: (nodeId, status) => set((s) => ({
    nodeStatuses: { ...s.nodeStatuses, [nodeId]: status },
  })),

  setNodeResult: (nodeId, result) => set((s) => ({
    nodeResults: { ...s.nodeResults, [nodeId]: result },
  })),

  setWaitingGate: (nodeId, options) => set((s) => ({
    waitingGates: { ...s.waitingGates, [nodeId]: options },
  })),

  resolveGate: (nodeId, selectedOption) => set((s) => {
    const newWaitingGates = { ...s.waitingGates }
    delete newWaitingGates[nodeId]
    return {
      waitingGates: newWaitingGates,
      nodeResults: { ...s.nodeResults, [nodeId]: { selected: selectedOption } },
      nodeStatuses: { ...s.nodeStatuses, [nodeId]: "done" },
    }
  }),

  setGraphFromJson: (graphJson) => set({
    nodes: graphJson.nodes || [],
    edges: graphJson.edges || [],
    history: [],
    historyIndex: -1,
    nodeStatuses: {},
    nodeResults: {},
  }),

  getGraphJson: () => {
    const s = get()
    return {
      nodes: JSON.parse(JSON.stringify(s.nodes)),
      edges: JSON.parse(JSON.stringify(s.edges)),
    }
  },

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

  onNodesChange: (changes) => set((s) => {
    let nodes = s.nodes
    for (const c of changes) {
      if (c.type === "position" && c.position) {
        nodes = nodes.map((n) => n.id === c.id ? { ...n, position: c.position! } : n)
      } else if (c.type === "remove") {
        nodes = nodes.filter((n) => n.id !== c.id)
      } else if (c.type === "select") {
        // handled by selectedNodeIds
      }
    }
    return { nodes }
  }),

  onEdgesChange: (changes) => set((s) => {
    let edges = s.edges
    for (const c of changes) {
      if (c.type === "remove") {
        edges = edges.filter((e) => e.id !== c.id)
      }
    }
    s.onDirty?.()
    return { edges }
  }),

  setOnDirty: (cb) => set({ onDirty: cb }),
}))
