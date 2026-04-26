import type { Connection, Edge, Node } from "@xyflow/react"
import { NODE_MAP } from "../nodes/nodeDefs"
import type { NodeType } from "../types/node"

const MAX_AUTO_INPUTS = 10

export function getOutputPortType(nodeId: string, handleId: string | null | undefined, nodes: Node[]) {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.outputs[0]?.type ?? null
  const staticPort = def.outputs.find((output) => output.id === handleId)
  if (staticPort) return staticPort.type
  if (node.data.nodeType === "image_list" && handleId.startsWith("image")) return "image_slot"
  return null
}

export function getInputPortType(nodeId: string, handleId: string | null | undefined, nodes: Node[]) {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return null
  const def = NODE_MAP[node.data.nodeType as NodeType]
  if (!def) return null
  if (!handleId) return def.inputs[0]?.type ?? null
  const staticPort = def.inputs.find((input) => input.id === handleId)
  if (staticPort) return staticPort.type
  if (node.data.nodeType === "image_list" && handleId.startsWith("img_in_")) return "image_slot"
  if (node.data.nodeType === "html_formatter" && handleId.startsWith("text_")) return "text"
  if (node.data.nodeType === "html_formatter" && (handleId === "images" || handleId.startsWith("image_"))) return "image_slot"
  return null
}

export function resolveAutoInputExpansion(connection: Connection, nodes: Node[], edges: Edge[]) {
  if (!connection.source || !connection.target || !connection.targetHandle) return null
  const sourceType = getOutputPortType(connection.source, connection.sourceHandle, nodes)
  const targetType = getInputPortType(connection.target, connection.targetHandle, nodes)
  if (!sourceType || !targetType || sourceType !== targetType) return null

  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!targetNode) return null

  const nodeType = targetNode.data.nodeType as NodeType
  const targetHandle = connection.targetHandle

  if (nodeType === "html_formatter" && targetType === "text" && targetHandle.startsWith("text_")) {
    const textInputs = (targetNode.data.textInputs as string[] | undefined) ?? ["text_1"]
    const existing = new Set(textInputs)
    for (let i = 1; i <= MAX_AUTO_INPUTS; i += 1) {
      const candidate = `text_${i}`
      if (!existing.has(candidate) || !isInputOccupied(edges, targetNode.id, candidate)) {
        return {
          targetHandle: candidate,
          data: existing.has(candidate) ? undefined : { textInputs: [...textInputs, candidate] },
        }
      }
    }
  }

  if (nodeType === "html_formatter" && targetType === "image_slot" && (targetHandle === "images" || targetHandle.startsWith("image_"))) {
    const imageInputs = (targetNode.data.imageInputs as string[] | undefined) ?? ["images"]
    const used = new Set(imageInputs)
    for (let i = 2; i <= MAX_AUTO_INPUTS; i += 1) {
      const candidate = `image_${i}`
      if (!used.has(candidate)) {
        return { targetHandle: candidate, data: { imageInputs: [...imageInputs, candidate] } }
      }
    }
  }

  if (nodeType === "image_list" && targetType === "image_slot" && targetHandle.startsWith("img_in_")) {
    const imageInputs = (targetNode.data.imageInputs as string[] | undefined) ?? ["img_in_1"]
    const candidate = nextNumberedHandle(imageInputs, "img_in_")
    if (!candidate) return null
    return { targetHandle: candidate, data: { imageInputs: [...imageInputs, candidate] } }
  }

  return null
}

function isInputOccupied(edges: Edge[], nodeId: string, handleId: string | null | undefined) {
  return edges.some((edge) => edge.target === nodeId && edge.targetHandle === handleId)
}

function nextNumberedHandle(existing: string[], prefix: string) {
  const used = new Set(existing)
  for (let i = 1; i <= MAX_AUTO_INPUTS; i += 1) {
    const candidate = `${prefix}${i}`
    if (!used.has(candidate)) return candidate
  }
  return null
}
