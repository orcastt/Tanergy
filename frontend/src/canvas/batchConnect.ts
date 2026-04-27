import type { Connection, Edge, Node, OnConnectStartParams } from "@xyflow/react"
import type { PortType } from "../types/node"
import {
  getInputPortType,
  getNodeInputPorts,
  getNodeOutputPorts,
  getOutputPortType,
  resolveAutoInputExpansion,
} from "./canvasConnectionRules"

export type NodeDataUpdate = { nodeId: string; data: Record<string, unknown> }

export type ConnectionBatch = {
  edges: Edge[]
  nodeDataUpdates: NodeDataUpdate[]
}

type Params = {
  connection: Connection
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  connectionStart: OnConnectStartParams | null
}

export function createConnectionBatch(params: Params): ConnectionBatch {
  const { connection, selectedNodeIds, connectionStart } = params
  if (!connection.source || !connection.target) return emptyBatch()

  const selected = new Set(selectedNodeIds)
  const startedFromSelected = connectionStart?.nodeId ? selected.has(connectionStart.nodeId) : false
  if (selected.size > 1 && startedFromSelected && connectionStart?.handleType === "source") {
    const batch = createSelectedSourceBatch(params)
    if (batch.edges.length > 0) return batch
  }
  if (selected.size > 1 && startedFromSelected && connectionStart?.handleType === "target") {
    const batch = createSelectedTargetBatch(params)
    if (batch.edges.length > 0) return batch
  }
  return createSingleConnectionBatch(params)
}

function createSelectedSourceBatch(params: Params): ConnectionBatch {
  const { connection, nodes, edges, selectedNodeIds } = params
  const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
  const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
  if (!sourceType || sourceType !== targetType) return emptyBatch()

  const batch = createWorkingBatch(nodes, edges)
  for (const node of getOrderedSelectedNodes(nodes, selectedNodeIds)) {
    if (node.id === connection.target) continue
    const sourceHandle = findOutputHandle(node, connection.sourceHandle, sourceType)
    if (!sourceHandle) continue
    batch.addConnection({ ...connection, source: node.id, sourceHandle })
  }
  return batch.result()
}

function createSelectedTargetBatch(params: Params): ConnectionBatch {
  const { connection, nodes, edges, selectedNodeIds } = params
  const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
  const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
  if (!sourceType || sourceType !== targetType) return emptyBatch()

  const batch = createWorkingBatch(nodes, edges)
  for (const node of getOrderedSelectedNodes(nodes, selectedNodeIds)) {
    if (node.id === connection.source) continue
    const targetHandle = findInputHandle(node, connection.targetHandle, sourceType)
    if (!targetHandle) continue
    batch.addConnection({ ...connection, target: node.id, targetHandle })
  }
  return batch.result()
}

function createSingleConnectionBatch(params: Params): ConnectionBatch {
  const batch = createWorkingBatch(params.nodes, params.edges)
  batch.addConnection(params.connection)
  return batch.result()
}

function createWorkingBatch(initialNodes: Node[], initialEdges: Edge[]) {
  let workingNodes = initialNodes
  const workingEdges = [...initialEdges]
  const edgesToAdd: Edge[] = []
  const updateMap = new Map<string, Record<string, unknown>>()

  function addConnection(connection: Connection) {
    const resolved = resolveTarget(connection, workingNodes, workingEdges)
    if (!resolved) return

    const edge: Edge = {
      id: buildEdgeId(connection.source, connection.sourceHandle, connection.target, resolved.targetHandle),
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: resolved.targetHandle,
    }
    if (hasEquivalentEdge(workingEdges, edge)) return

    edgesToAdd.push(edge)
    workingEdges.push(edge)
    if (resolved.data) {
      updateMap.set(connection.target, { ...updateMap.get(connection.target), ...resolved.data })
      workingNodes = applyNodeData(workingNodes, connection.target, resolved.data)
    }
  }

  return {
    addConnection,
    result: (): ConnectionBatch => ({
      edges: edgesToAdd,
      nodeDataUpdates: Array.from(updateMap, ([nodeId, data]) => ({ nodeId, data })),
    }),
  }
}

function resolveTarget(connection: Connection, nodes: Node[], edges: Edge[]) {
  const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
  const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
  if (!sourceType || !targetType || sourceType !== targetType) return null
  if (!isInputOccupied(edges, connection.target, connection.targetHandle)) {
    return { targetHandle: connection.targetHandle, data: undefined }
  }
  return resolveAutoInputExpansion(connection, nodes, edges)
}

function findOutputHandle(node: Node, preferredHandle: string | null, portType: PortType) {
  const ports = getNodeOutputPorts(node)
  return ports.find((port) => port.id === preferredHandle && port.type === portType)?.id
    ?? ports.find((port) => port.type === portType)?.id
    ?? null
}

function findInputHandle(node: Node, preferredHandle: string | null, portType: PortType) {
  const ports = getNodeInputPorts(node)
  return ports.find((port) => port.id === preferredHandle && port.type === portType)?.id
    ?? ports.find((port) => port.type === portType)?.id
    ?? null
}

function getOrderedSelectedNodes(nodes: Node[], selectedNodeIds: string[]) {
  const selected = new Set(selectedNodeIds)
  return nodes
    .filter((node) => selected.has(node.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
}

function applyNodeData(nodes: Node[], nodeId: string, data: Record<string, unknown>) {
  return nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node)
}

function isInputOccupied(edges: Edge[], nodeId: string, handleId: string | null) {
  return edges.some((edge) => edge.target === nodeId && edge.targetHandle === handleId)
}

function hasEquivalentEdge(edges: Edge[], edge: Edge) {
  return edges.some((existing) => (
    existing.source === edge.source
    && existing.sourceHandle === edge.sourceHandle
    && existing.target === edge.target
    && existing.targetHandle === edge.targetHandle
  ))
}

function buildEdgeId(source: string, sourceHandle: string | null, target: string, targetHandle: string | null) {
  return `e-${source}-${sourceHandle ?? "default"}-${target}-${targetHandle ?? "default"}`
}

function emptyBatch(): ConnectionBatch {
  return { edges: [], nodeDataUpdates: [] }
}
