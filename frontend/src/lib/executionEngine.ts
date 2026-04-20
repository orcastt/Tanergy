import { getExecutionLayers, hasCycle } from "./dagUtils"
import { useCanvasStore } from "../store/canvasStore"
import type { NodeType } from "../types/node"

export type RunAllOptions = {
  onNodeStart?: (nodeId: string) => void
  onNodeComplete?: (nodeId: string, result: unknown) => void
  onNodeError?: (nodeId: string, error: string) => void
  onGateWait?: (nodeId: string, options: string[]) => void
  onComplete?: () => void
}

async function executeNode(node: any, inputData: any, options: RunAllOptions): Promise<unknown> {
  const type = node.data.nodeType as NodeType

  if (type === "gate") {
    const outlineOptions = inputData.in as string[] | undefined
    const options_list = outlineOptions ?? ["方向 A", "方向 B", "方向 C"]

    useCanvasStore.getState().setNodeStatus(node.id, "waiting")
    useCanvasStore.getState().setWaitingGate(node.id, options_list)
    options.onGateWait?.(node.id, options_list)

    // MVP placeholder: auto-resolve after 2s (real impl waits for user click)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const selected = options_list[0]

    useCanvasStore.getState().resolveGate(node.id, selected)
    return { selected }
  }

  await new Promise((r) => setTimeout(r, 800))
  return { ok: true, nodeType: type }
}

export async function runAll(options: RunAllOptions = {}) {
  const { nodes, edges } = useCanvasStore.getState()

  if (nodes.length === 0) return
  if (hasCycle(nodes, edges)) {
    throw new Error("图中存在环路，请检查连线")
  }

  const layers = getExecutionLayers(nodes, edges)

  for (const layer of layers) {
    const promises = layer.map(async (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId)!
      const { setNodeStatus, nodeResults } = useCanvasStore.getState()

      setNodeStatus(nodeId, "running")
      options.onNodeStart?.(nodeId)

      try {
        const inputData: Record<string, unknown> = {}
        for (const e of edges) {
          if (e.target === nodeId) {
            const key = (e.targetHandle ?? "in") as string
            inputData[key] = nodeResults[e.source]
          }
        }

        const result = await executeNode(node, inputData, options)

        setNodeStatus(nodeId, "done")
        useCanvasStore.setState((s) => ({
          nodeResults: { ...s.nodeResults, [nodeId]: result },
        }))
        options.onNodeComplete?.(nodeId, result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setNodeStatus(nodeId, "error")
        options.onNodeError?.(nodeId, msg)
        throw err
      }
    })

    await Promise.all(promises)
  }

  options.onComplete?.()
}

export function stopAll() {
  useCanvasStore.setState((s) => {
    const statuses: Record<string, "idle"> = {}
    for (const id of Object.keys(s.nodeStatuses)) {
      if (s.nodeStatuses[id] === "running" || s.nodeStatuses[id] === "waiting") {
        statuses[id] = "idle"
      }
    }
    return { nodeStatuses: { ...s.nodeStatuses, ...statuses } }
  })
}