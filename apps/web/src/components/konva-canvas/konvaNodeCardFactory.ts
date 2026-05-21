import type { CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'
import {
  createDefaultNodeData,
  createDefaultRuntimeSummary,
  getDefaultNodeCardSize,
  getNodeDefinition,
} from '@/features/node-runtime/registry'

type CreateKonvaNodeCardInput = {
  data?: JsonObject
  idHint?: string
  position: CanvasPoint
  type: NodeType
}

type NodeJsonValue = JsonObject[string]

export function createKonvaNodeCardShape(input: CreateKonvaNodeCardInput): CanvasNodeShape {
  const definition = getNodeDefinition(input.type)
  const id = createKonvaNodeCardId(input.type, input.idHint)
  const { height, width } = getDefaultNodeCardSize(input.type)

  return {
    id,
    props: {
      data: {
        ...createDefaultNodeData(input.type),
        ...sanitizeNodeData(input.data ?? {}),
      },
      height,
      nodeId: `${input.type}-${id.slice(-6)}`,
      nodeType: input.type,
      runtimeSummary: createDefaultRuntimeSummary(input.type),
      version: definition.version,
      width,
    },
    type: 'node_card',
    x: Math.round(input.position.x - width / 2),
    y: Math.round(input.position.y - 32),
  }
}

function createKonvaNodeCardId(type: NodeType, idHint?: string) {
  const entropy = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.round(Math.random() * 1000)}`
  return `konva-node-${idHint ?? type}-${entropy}`
}

function sanitizeNodeData(data: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => isSafeNodeDataEntry(key, value))
      .map(([key, value]) => [key, sanitizeJsonValue(value)])
      .filter((entry): entry is [string, NodeJsonValue] => entry[1] !== undefined)
  ) as JsonObject
}

function sanitizeJsonValue(value: unknown): NodeJsonValue | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return undefined
    if (value.length > 2000) return value.slice(0, 2000)
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is NodeJsonValue => item !== undefined)
  }
  if (value && typeof value === 'object') {
    return sanitizeNodeData(value as Record<string, unknown>)
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

function isSafeNodeDataEntry(key: string, value: unknown) {
  const normalizedKey = key.toLowerCase()
  if (
    normalizedKey.includes('base64') ||
    normalizedKey.includes('blob') ||
    normalizedKey.includes('raw') ||
    normalizedKey.includes('provider') ||
    normalizedKey.includes('responselog')
  ) {
    return false
  }
  return value !== undefined
}
