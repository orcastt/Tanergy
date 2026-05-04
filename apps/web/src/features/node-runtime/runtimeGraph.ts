import type { CanvasDocument, CanvasNodeShape, CanvasRuntimeEdge } from '@/features/canvas-engine'
import { withCanvasRuntimeEdges, withCanvasShapes } from '@/features/canvas-engine'
import type { JsonObject, NodePortDataType } from '@/types/nodeRuntime'
import { getResolvedNodePorts, maxImageInputPorts } from './registry'

export type RuntimeGraphEdge = CanvasRuntimeEdge

type RuntimeGraphConnectionCheck = {
  reason: string
  valid: boolean
}

export function addRuntimeGraphEdge(
  document: CanvasDocument,
  edge: Omit<RuntimeGraphEdge, 'id'>
): CanvasDocument {
  if (!validateRuntimeGraphConnection(document, edge).valid) return document
  return reconcileRuntimeGraphDocument(withCanvasRuntimeEdges(document, [
    ...document.runtimeEdges.filter((item) => !targetsSameInput(item, edge)),
    { ...edge, id: createRuntimeGraphEdgeId(edge.dataType) },
  ]))
}

export function removeRuntimeGraphEdge(document: CanvasDocument, edgeId: string): CanvasDocument {
  return reconcileRuntimeGraphDocument(withCanvasRuntimeEdges(
    document,
    document.runtimeEdges.filter((edge) => edge.id !== edgeId)
  ))
}

export function removeRuntimeGraphEdgesForShapes(document: CanvasDocument, shapeIds: string[]): CanvasDocument {
  const selected = new Set(shapeIds)
  return reconcileRuntimeGraphDocument(withCanvasRuntimeEdges(
    document,
    document.runtimeEdges.filter((edge) => !selected.has(edge.sourceShapeId) && !selected.has(edge.targetShapeId))
  ))
}

export function setRuntimeGraphImageNodeOwnData(
  document: CanvasDocument,
  shapeId: string,
  data: JsonObject
): CanvasDocument {
  const withoutIncomingImage = withCanvasRuntimeEdges(document, document.runtimeEdges.filter((edge) => !(
    edge.targetShapeId === shapeId &&
    edge.targetPortId === 'image_in' &&
    edge.dataType === 'image'
  )))
  return reconcileRuntimeGraphDocument(mapRuntimeGraphShapes(withoutIncomingImage, (shape) => {
    if (!isImageNode(shape) || shape.id !== shapeId) return shape
    return updateNodeData(shape, pruneUndefined({
      ...shape.props.data,
      ...data,
      inputSourceEdgeId: undefined,
    }))
  }))
}

export function reconcileRuntimeGraphDocument(document: CanvasDocument): CanvasDocument {
  const counted = syncDynamicImageInputCounts(document)
  const pruned = pruneInvalidRuntimeGraphEdges(counted)
  return syncImageNodeInputPreviews(syncDynamicImageInputCounts(pruned))
}

export function validateRuntimeGraphConnection(
  document: CanvasDocument,
  edge: Omit<RuntimeGraphEdge, 'id'> | RuntimeGraphEdge
): RuntimeGraphConnectionCheck {
  const source = getNodeShape(document, edge.sourceShapeId)
  const target = getNodeShape(document, edge.targetShapeId)
  if (!source || !target) return { reason: 'Missing source or target node', valid: false }
  if (source.id === target.id) return { reason: 'A node cannot connect to itself', valid: false }

  const sourcePort = getNodePort(source, edge.sourcePortId)
  const targetPort = getNodePort(target, edge.targetPortId)
  if (!sourcePort || !targetPort) return { reason: 'Missing source or target port', valid: false }
  if (sourcePort.direction !== 'out' || targetPort.direction !== 'in') return { reason: 'Connections must flow from output to input', valid: false }
  if (sourcePort.dataType !== targetPort.dataType || sourcePort.dataType !== edge.dataType) return { reason: 'Port type mismatch', valid: false }
  return { reason: `${edge.dataType} connection accepted`, valid: true }
}

export function getRuntimeImageInputCount(document: CanvasDocument, shapeId: string) {
  return document.runtimeEdges.filter((edge) => edge.targetShapeId === shapeId && edge.dataType === 'image').length
}

export function getIncomingRuntimeGraphEdges(document: CanvasDocument, shapeId: string) {
  return document.runtimeEdges.filter((edge) => edge.targetShapeId === shapeId)
}

export function getOutgoingRuntimeGraphEdges(document: CanvasDocument, shapeId: string) {
  return document.runtimeEdges.filter((edge) => edge.sourceShapeId === shapeId)
}

function syncDynamicImageInputCounts(document: CanvasDocument): CanvasDocument {
  const imageInputCounts = new Map<string, number>()
  for (const edge of document.runtimeEdges) {
    if (edge.dataType !== 'image') continue
    imageInputCounts.set(edge.targetShapeId, (imageInputCounts.get(edge.targetShapeId) ?? 0) + 1)
  }

  return mapRuntimeGraphShapes(document, (shape) => {
    if (!isImageInputCountNode(shape)) return shape
    const nextCount = Math.min(Math.max((imageInputCounts.get(shape.id) ?? 0) + 1, 1), maxImageInputPorts)
    if (Number(shape.props.data.imageInputCount ?? 1) === nextCount) return shape
    return updateNodeData(shape, { ...shape.props.data, imageInputCount: nextCount })
  })
}

function pruneInvalidRuntimeGraphEdges(document: CanvasDocument): CanvasDocument {
  const runtimeEdges = document.runtimeEdges.filter((edge) => validateRuntimeGraphConnection(document, edge).valid)
  if (runtimeEdges.length === document.runtimeEdges.length) return document
  return withCanvasRuntimeEdges(document, runtimeEdges)
}

function syncImageNodeInputPreviews(document: CanvasDocument): CanvasDocument {
  const shapeById = new Map(document.shapes.map((shape) => [shape.id, shape]))
  return mapRuntimeGraphShapes(document, (shape) => {
    if (!isImageNode(shape)) return shape

    const input = document.runtimeEdges.find((edge) => (
      edge.targetShapeId === shape.id &&
      edge.targetPortId === 'image_in' &&
      edge.dataType === 'image'
    ))
    const source = input ? shapeById.get(input.sourceShapeId) : null
    const payload = source && source.type === 'node_card' ? getImageNodePayload(source.props.data) : null

    if (!input || !payload) {
      return hasUpstreamImageData(shape.props.data) ? updateNodeData(shape, clearUpstreamImageData(shape.props.data)) : shape
    }

    return updateNodeData(shape, pruneUndefined({
      ...shape.props.data,
      ...payload,
      inputSourceEdgeId: input.id,
    }))
  })
}

function mapRuntimeGraphShapes(
  document: CanvasDocument,
  updateShape: (shape: CanvasDocument['shapes'][number]) => CanvasDocument['shapes'][number]
): CanvasDocument {
  let changed = false
  const shapes = document.shapes.map((shape) => {
    const nextShape = updateShape(shape)
    if (nextShape !== shape) changed = true
    return nextShape
  })
  return changed ? withCanvasShapes(document, shapes) : document
}

function targetsSameInput(edge: Pick<RuntimeGraphEdge, 'targetPortId' | 'targetShapeId'>, other: Pick<RuntimeGraphEdge, 'targetPortId' | 'targetShapeId'>) {
  return edge.targetShapeId === other.targetShapeId && edge.targetPortId === other.targetPortId
}

function getNodeShape(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card') ?? null
}

function getNodePort(shape: CanvasNodeShape, portId: string) {
  return getResolvedNodePorts(shape.props.nodeType, shape.props.data).find((port) => port.id === portId) ?? null
}

function isImageInputCountNode(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && (shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4')
}

function isImageNode(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'image'
}

function hasUpstreamImageData(data: JsonObject) {
  return typeof data.inputSourceEdgeId === 'string'
}

function clearUpstreamImageData(data: JsonObject): JsonObject {
  return pruneUndefined({
    ...data,
    assetId: undefined,
    imageHeight: undefined,
    imageWidth: undefined,
    inputSourceEdgeId: undefined,
    originalUrl: undefined,
    thumbnail1024Url: undefined,
    thumbnail256Url: undefined,
    thumbnail512Url: undefined,
    title: undefined,
  })
}

function getImageNodePayload(data: JsonObject): JsonObject | null {
  if (typeof data.assetId !== 'string' && typeof data.originalUrl !== 'string' && typeof data.thumbnail512Url !== 'string') return null
  return pruneUndefined({
    assetId: data.assetId,
    imageHeight: data.imageHeight,
    imageWidth: data.imageWidth,
    originalUrl: data.originalUrl,
    thumbnail1024Url: data.thumbnail1024Url,
    thumbnail256Url: data.thumbnail256Url,
    thumbnail512Url: data.thumbnail512Url,
    title: data.title,
  })
}

function updateNodeData(shape: CanvasNodeShape, data: JsonObject): CanvasNodeShape {
  return {
    ...shape,
    props: {
      ...shape.props,
      data,
    },
  }
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}

function createRuntimeGraphEdgeId(dataType: NodePortDataType) {
  return `runtime-edge-${dataType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
