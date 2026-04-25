import { getExecutionLayers, hasCycle } from "./dagUtils"
import { useCanvasStore } from "../store/canvasStore"
import { useWorkflowStore } from "../store/workflowStore"
import { tauri } from "../services/tauri"
import type { NodeType } from "../types/node"

export type RunAllOptions = {
  onNodeStart?: (nodeId: string) => void
  onNodeComplete?: (nodeId: string, result: unknown) => void
  onNodeError?: (nodeId: string, error: string) => void
  onGateWait?: (nodeId: string, options: string[]) => void
  onComplete?: () => void
}

const AI_NODES: Set<string> = new Set(["research", "outline_generator", "writer", "reviewer", "image_planner", "image_gen", "image_list", "html_formatter"])

function extractGateOptions(inputData: Record<string, unknown>): string[] {
  const input = inputData.in
  if (Array.isArray(input)) return input as string[]

  // outline_generator output format: { options: [{ title, angle, sections }] }
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>
    if (Array.isArray(obj.options)) {
      return (obj.options as Array<Record<string, unknown>>).map(
        (o) => `${o.title ?? ""} — ${o.angle ?? ""}`
      )
    }
    // raw text fallback
    if (typeof obj.raw === "string") return [obj.raw]
    if (typeof obj.text === "string") return [obj.text]
  }

  if (typeof input === "string") return [input]

  return ["Direction A", "Direction B", "Direction C"]
}

function waitForGateResolve(nodeId: string): Promise<string> {
  return new Promise((resolve) => {
    const unsub = useCanvasStore.subscribe((state) => {
      const result = state.nodeResults[nodeId]
      if (state.nodeStatuses[nodeId] === "done" && result && typeof result === "object" && "selected" in (result as Record<string, unknown>)) {
        unsub()
        resolve((result as { selected: string }).selected)
      }
    })
  })
}

async function executeNode(node: any, inputData: any, options: RunAllOptions): Promise<unknown> {
  const type = node.data.nodeType as NodeType
  const nodeData = node.data as Record<string, unknown>

  if (type === "gate") {
    const mode = (nodeData.mode as string) ?? "select"

    if (mode === "select") {
      const optionsList = extractGateOptions(inputData as Record<string, unknown>)
      useCanvasStore.getState().setWaitingGate(node.id, optionsList)
      useCanvasStore.getState().setNodeStatus(node.id, "waiting")
      options.onGateWait?.(node.id, optionsList)

      const selected = await waitForGateResolve(node.id)
      return { selected }
    }

    // input mode — wait for user text input
    useCanvasStore.getState().setWaitingGate(node.id, ["Waiting for input..."])
    useCanvasStore.getState().setNodeStatus(node.id, "waiting")
    options.onGateWait?.(node.id, ["Waiting for input..."])

    const selected = await waitForGateResolve(node.id)
    return { selected }
  }

  // Route through Tauri IPC
  if (type === "text_input" || AI_NODES.has(type)) {
    const workflowId = useWorkflowStore.getState().currentWorkflow?.id ?? "default"
    const enrichedData = {
      ...nodeData,
      workflow_id: workflowId,
      node_id: node.id,
    }
    const result = await tauri.executeNode({
      node_type: type,
      node_data: enrichedData,
      input_data: inputData as Record<string, unknown>,
    })
    return result.output
  }

  // image_gallery: aggregate images from all connected upstream nodes
  if (type === "image_gallery") {
    const allImages: unknown[] = []
    for (const key of Object.keys(inputData)) {
      const upstream = inputData[key] as { images?: unknown[] } | undefined
      if (upstream?.images) {
        allImages.push(...upstream.images)
      }
    }
    return { images: allImages }
  }

  // Fallback for unimplemented nodes
  await new Promise((r) => setTimeout(r, 500))
  return { ok: true, nodeType: type }
}

// Track running state for stopAll
let running = false

function gatherInputData(nodeId: string, edges: any[], nodeResults: Record<string, unknown>): Record<string, unknown> {
  const inputData: Record<string, unknown> = {}
  for (const e of edges) {
    if (e.target === nodeId) {
      const key = (e.targetHandle ?? "in") as string
      const sourceResult = nodeResults[e.source]
      if (e.sourceHandle && sourceResult && typeof sourceResult === "object") {
        const specific = (sourceResult as Record<string, unknown>)[e.sourceHandle]
        inputData[key] = specific ?? sourceResult
      } else {
        inputData[key] = sourceResult
      }
    }
  }
  return inputData
}

async function executeSingleNode(nodeId: string, nodes: any[], edges: any[], options: RunAllOptions): Promise<void> {
  if (!running) return

  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return

  const { setNodeStatus, nodeResults } = useCanvasStore.getState()
  setNodeStatus(nodeId, "running")
  options.onNodeStart?.(nodeId)

  try {
    const inputData = gatherInputData(nodeId, edges, nodeResults)
    const result = await executeNode(node, inputData, options)

    if (!running) {
      // Stopped while executing — keep result but mark as stopped
      setNodeStatus(nodeId, "error")
      useCanvasStore.setState((s) => ({
        nodeResults: { ...s.nodeResults, [nodeId]: result },
      }))
      return
    }

    setNodeStatus(nodeId, "done")
    useCanvasStore.setState((s) => ({
      nodeResults: { ...s.nodeResults, [nodeId]: result },
    }))
    options.onNodeComplete?.(nodeId, result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "LOGIN_REQUIRED" || msg.includes("LOGIN_REQUIRED")) {
      setNodeStatus(nodeId, "error")
      useCanvasStore.setState((s) => ({
        nodeResults: { ...s.nodeResults, [nodeId]: { error: "Please log in or configure an API Key to use AI features" } },
      }))
      options.onNodeError?.(nodeId, "LOGIN_REQUIRED")
      return
    }
    if (msg.includes("INSUFFICIENT_CREDITS")) {
      setNodeStatus(nodeId, "error")
      useCanvasStore.setState((s) => ({
        nodeResults: { ...s.nodeResults, [nodeId]: { error: "Insufficient credits. Please purchase more credits." } },
      }))
      options.onNodeError?.(nodeId, "INSUFFICIENT_CREDITS")
      return
    }
    setNodeStatus(nodeId, "error")
    options.onNodeError?.(nodeId, msg)
    throw err
  }
}

export async function runAll(options: RunAllOptions = {}) {
  const { nodes, edges } = useCanvasStore.getState()

  if (nodes.length === 0) return
  if (hasCycle(nodes, edges)) {
    throw new Error("Cycle detected in the graph. Please check your connections.")
  }

  running = true
  const layers = getExecutionLayers(nodes, edges)

  try {
    for (const layer of layers) {
      if (!running) break
      await Promise.all(layer.map((nodeId) => executeSingleNode(nodeId, nodes, edges, options)))
    }
    options.onComplete?.()
  } finally {
    running = false
  }
}

export async function runSingleNode(nodeId: string) {
  const { nodes, edges } = useCanvasStore.getState()
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return

  running = true
  try {
    await executeSingleNode(nodeId, nodes, edges, {})
  } finally {
    running = false
  }
}

export function stopAll() {
  running = false
  // Running/waiting nodes: keep results if API already returned, mark red (error); else reset to idle
  const { nodeStatuses, nodeResults } = useCanvasStore.getState()
  const updates: Record<string, "idle" | "error"> = {}
  for (const id of Object.keys(nodeStatuses)) {
    if (nodeStatuses[id] === "running" || nodeStatuses[id] === "waiting") {
      updates[id] = nodeResults[id] ? "error" : "idle"
    }
  }
  useCanvasStore.setState({ nodeStatuses: { ...nodeStatuses, ...updates } })
}

export function isRunning() {
  return running
}
