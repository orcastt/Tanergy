import type { AgentAction } from "./agentStore"
import { useCanvasStore } from "../store/canvasStore"
import { NODE_MAP } from "../nodes/nodeDefs"
import type { NodeType } from "../types/node"
import { runAll } from "../lib/executionEngine"

function isValidPort(nodeType: string, portId: string, direction: "input" | "output"): boolean {
  const def = NODE_MAP[nodeType as NodeType]
  if (!def) return false
  const ports = direction === "input" ? def.inputs : def.outputs
  return ports.some((p) => p.id === portId)
}

// Approximate node height for spacing calculation
const NODE_HEIGHT = 120
const GAP_Y = 150

function getPlacementOrigin(existingNodes: { position: { x: number; y: number }; measured?: { height?: number } }[]): { x: number; y: number } {
  if (existingNodes.length === 0) return { x: 200, y: 200 }

  // Find the bottom edge of the lowest existing node
  let maxY = 0
  for (const node of existingNodes) {
    const height = node.measured?.height ?? NODE_HEIGHT
    const bottom = node.position.y + height
    if (bottom > maxY) maxY = bottom
  }

  return { x: 200, y: maxY + GAP_Y }
}

export function buildActions(actions: AgentAction[]) {
  const { addNode, addEdge, nodes } = useCanvasStore.getState()
  const nameToId = new Map<string, string>()
  const nameToType = new Map<string, string>()

  const origin = getPlacementOrigin(nodes)
  let offsetX = origin.x
  const offsetY = origin.y
  let hasConnections = false

  // First pass: add all nodes
  for (const action of actions) {
    if (action.op === "add" && action.type) {
      const def = NODE_MAP[action.type as NodeType]
      if (!def) {
        console.warn(`nodeBuilder: unknown node type "${action.type}"`)
        continue
      }

      const id = crypto.randomUUID()
      const name = action.name ?? action.type
      nameToId.set(name, id)
      nameToType.set(name, action.type)

      const pos = action.position
        ? { x: action.position[0], y: action.position[1] }
        : { x: offsetX, y: offsetY }

      offsetX += 300

      const customData = action.data ?? {}
      addNode({
        id,
        type: action.type,
        position: pos,
        data: { nodeType: action.type, ...def.defaultData, ...customData },
      })
    }
  }

  // Second pass: add all connections with port validation
  for (const action of actions) {
    if (action.op === "connect" && action.from && action.to) {
      const sourceId = nameToId.get(action.from)
      const targetId = nameToId.get(action.to)

      if (!sourceId || !targetId) {
        console.warn(`nodeBuilder: unknown node name in connect "${action.from}" → "${action.to}"`)
        continue
      }

      const sourceHandle = action.fromPort ?? "out"
      const targetHandle = action.toPort ?? "in"

      const sourceType = nameToType.get(action.from)!
      const targetType = nameToType.get(action.to)!

      if (!isValidPort(sourceType, sourceHandle, "output")) {
        console.warn(`nodeBuilder: invalid source port "${sourceType}.${sourceHandle}"`)
        continue
      }
      if (!isValidPort(targetType, targetHandle, "input")) {
        console.warn(`nodeBuilder: invalid target port "${targetType}.${targetHandle}"`)
        continue
      }

      const existing = useCanvasStore.getState().edges.find(
        (e) => e.target === targetId && e.targetHandle === targetHandle
      )
      if (existing) continue

      addEdge({
        id: `e-${sourceId}-${sourceHandle}-${targetId}-${targetHandle}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      })
      hasConnections = true
    }
  }

  // Auto-run if we have connections (a complete pipeline)
  if (hasConnections) {
    setTimeout(() => {
      runAll().catch(console.error)
    }, 500)
  }
}
