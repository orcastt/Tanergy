import type { AgentAction } from "./agentStore"
import { useCanvasStore } from "../store/canvasStore"
import { NODE_MAP } from "../nodes/nodeDefs"
import type { NodeType } from "../types/node"

export function buildActions(actions: AgentAction[]) {
  const { addNode, addEdge } = useCanvasStore.getState()
  const idMap = new Map<string, string>()

  let offsetX = 200
  const offsetY = 200

  for (const action of actions) {
    if (action.op === "add" && action.type) {
      const def = NODE_MAP[action.type as NodeType]
      if (!def) continue

      const id = crypto.randomUUID()
      idMap.set(action.type, id)

      const pos = action.position
        ? { x: action.position[0], y: action.position[1] }
        : { x: offsetX, y: offsetY }

      offsetX += 300

      addNode({
        id,
        type: action.type,
        position: pos,
        data: { nodeType: action.type, ...def.defaultData },
      })
    }

    if (action.op === "connect" && action.from && action.to) {
      const sourceId = idMap.get(action.from) ?? action.from
      const targetId = idMap.get(action.to) ?? action.to

      const sourceHandle = action.fromPort ?? "out"
      const targetHandle = action.toPort ?? "in"

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
    }
  }
}
