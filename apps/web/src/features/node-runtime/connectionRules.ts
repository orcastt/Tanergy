import type { VecLike } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodePortDataType, ResolvedNodePort } from '@/types/nodeRuntime'
import { getPortColorName, getPortsByDirection, getResolvedNodePorts } from './registry'

type ConnectionCheck = {
  dataType?: NodePortDataType
  reason: string
  valid: boolean
}

export type NodePortAnchor = {
  dataType: NodePortDataType
  direction: 'in' | 'out'
  id: string
  label: string
  x: number
  y: number
}

export function getNodePortAnchors(shape: NodeCardShape): NodePortAnchor[] {
  const data = asJsonObject(shape.props.data)
  return getResolvedNodePorts(shape.props.nodeType, data).map((port) => ({
    dataType: port.dataType,
    direction: port.direction,
    id: port.id,
    label: port.label,
    x: port.direction === 'in' ? 0 : 1,
    y: port.anchorY,
  }))
}

export function getNodePortForAnchor(shape: NodeCardShape, anchor: VecLike): ResolvedNodePort | null {
  const data = asJsonObject(shape.props.data)
  const direction = anchor.x > 0.5 ? 'out' : 'in'
  const ports = getPortsByDirection(shape.props.nodeType, data, direction)
  if (ports.length === 0) return null

  return ports.reduce((best, port) => {
    return Math.abs(port.anchorY - anchor.y) < Math.abs(best.anchorY - anchor.y) ? port : best
  }, ports[0])
}

export function validateNodeConnection(
  source: NodeCardShape,
  sourcePort: ResolvedNodePort,
  target: NodeCardShape,
  targetPort: ResolvedNodePort
): ConnectionCheck {
  if (sourcePort.direction !== 'out' || targetPort.direction !== 'in') {
    return { reason: 'Connections must flow from output to input', valid: false }
  }

  if (sourcePort.dataType !== targetPort.dataType) {
    return {
      reason: `Port type mismatch: ${sourcePort.dataType} cannot connect to ${targetPort.dataType}`,
      valid: false,
    }
  }

  if (source.id === target.id) {
    return { reason: 'A node cannot connect to itself', valid: false }
  }

  return {
    dataType: sourcePort.dataType,
    reason: `${sourcePort.dataType} connection accepted`,
    valid: true,
  }
}

export function getArrowColorForDataType(dataType: NodePortDataType) {
  return getPortColorName(dataType)
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
