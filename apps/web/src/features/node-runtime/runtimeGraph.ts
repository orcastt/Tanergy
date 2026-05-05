import type { CanvasDocument, CanvasNodeShape, CanvasRuntimeEdge } from '@/features/canvas-engine'
import { withCanvasRuntimeEdges, withCanvasShapes } from '@/features/canvas-engine'
import type { JsonObject, NodePortDataType } from '@/types/nodeRuntime'
import { getResolvedNodePorts, maxChatInputPorts, maxImageInputPorts, maxTextInputPorts } from './registry'
import { getRuntimeGraphGeneratedOutputPayload, getRuntimeGraphImageNodePayload } from './runtimeGraphAssets'

export type RuntimeGraphEdge = CanvasRuntimeEdge

type RuntimeGraphConnectionCheck = {
  reason: string
  valid: boolean
}

type ImageInputCountNodeShape = CanvasNodeShape & {
  props: CanvasNodeShape['props'] & {
    nodeType: 'image_gen' | 'image_gen_4'
  }
}

type ChatNodeShape = CanvasNodeShape & {
  props: CanvasNodeShape['props'] & {
    nodeType: 'chat'
  }
}

export function addRuntimeGraphEdge(
  document: CanvasDocument,
  edge: Omit<RuntimeGraphEdge, 'id'>
): CanvasDocument {
  const preparedDocument = prepareDocumentForRuntimeGraphEdges(document, [edge])
  if (!validateRuntimeGraphConnection(preparedDocument, edge).valid) return document
  return addRuntimeGraphEdges(preparedDocument, [edge])
}

export function addRuntimeGraphEdges(
  document: CanvasDocument,
  edges: Omit<RuntimeGraphEdge, 'id'>[]
): CanvasDocument {
  if (edges.length === 0) return document
  const preparedDocument = prepareDocumentForRuntimeGraphEdges(document, edges)
  const validEdges = edges.filter((edge) => validateRuntimeGraphConnection(preparedDocument, edge).valid)
  if (validEdges.length === 0) return document
  const replacedInputs = new Set(validEdges.map(getTargetInputKey))
  return reconcileRuntimeGraphDocument(withCanvasRuntimeEdges(preparedDocument, [
    ...preparedDocument.runtimeEdges.filter((item) => !replacedInputs.has(getTargetInputKey(item))),
    ...validEdges.map((edge) => ({ ...edge, id: createRuntimeGraphEdgeId(edge.dataType) })),
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
  const counted = syncDynamicInputCounts(document)
  const pruned = pruneInvalidRuntimeGraphEdges(counted)
  return syncImageNodeInputPreviews(syncDynamicInputCounts(pruned))
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

function syncDynamicInputCounts(document: CanvasDocument): CanvasDocument {
  const imageInputCounts = new Map<string, number>()
  const maxImageInputIndexes = new Map<string, number>()
  const textInputCounts = new Map<string, number>()
  const maxTextInputIndexes = new Map<string, number>()
  for (const edge of document.runtimeEdges) {
    if (edge.dataType === 'image') {
      imageInputCounts.set(edge.targetShapeId, (imageInputCounts.get(edge.targetShapeId) ?? 0) + 1)
      maxImageInputIndexes.set(edge.targetShapeId, Math.max(maxImageInputIndexes.get(edge.targetShapeId) ?? 0, getDynamicInputIndex(edge.targetPortId, 'image_in')))
    }
    if (edge.dataType === 'text') {
      textInputCounts.set(edge.targetShapeId, (textInputCounts.get(edge.targetShapeId) ?? 0) + 1)
      maxTextInputIndexes.set(edge.targetShapeId, Math.max(maxTextInputIndexes.get(edge.targetShapeId) ?? 0, getDynamicInputIndex(edge.targetPortId, 'text_in')))
    }
  }

  return mapRuntimeGraphShapes(document, (shape) => {
    if (isImageInputCountNode(shape)) {
      const nextCount = getNextDynamicInputCount(shape.id, imageInputCounts, maxImageInputIndexes, maxImageInputPorts)
      const nextTextCount = getNextDynamicInputCount(shape.id, textInputCounts, maxTextInputIndexes, maxTextInputPorts)
      if (Number(shape.props.data.imageInputCount ?? 1) === nextCount && Number(shape.props.data.textInputCount ?? 1) === nextTextCount) return shape
      return updateNodeData(shape, { ...shape.props.data, imageInputCount: nextCount, textInputCount: nextTextCount })
    }
    if (isChatNode(shape)) {
      const nextImageCount = getNextDynamicInputCount(shape.id, imageInputCounts, maxImageInputIndexes, maxChatInputPorts)
      const nextTextCount = getNextDynamicInputCount(shape.id, textInputCounts, maxTextInputIndexes, maxChatInputPorts)
      if (Number(shape.props.data.imageInputCount ?? 1) === nextImageCount && Number(shape.props.data.textInputCount ?? 1) === nextTextCount) return shape
      return updateNodeData(shape, { ...shape.props.data, imageInputCount: nextImageCount, textInputCount: nextTextCount })
    }
    return shape
  })
}

function prepareDocumentForRuntimeGraphEdges(document: CanvasDocument, edges: Omit<RuntimeGraphEdge, 'id'>[]): CanvasDocument {
  const requiredImageInputCounts = new Map<string, number>()
  const requiredTextInputCounts = new Map<string, number>()
  for (const edge of edges) {
    if (edge.dataType === 'image') {
      const index = getDynamicInputIndex(edge.targetPortId, 'image_in')
      if (index) requiredImageInputCounts.set(edge.targetShapeId, Math.max(requiredImageInputCounts.get(edge.targetShapeId) ?? 1, index))
    }
    if (edge.dataType === 'text') {
      const index = getDynamicInputIndex(edge.targetPortId, 'text_in')
      if (index) requiredTextInputCounts.set(edge.targetShapeId, Math.max(requiredTextInputCounts.get(edge.targetShapeId) ?? 1, index))
    }
  }
  if (requiredImageInputCounts.size === 0 && requiredTextInputCounts.size === 0) return document
  return mapRuntimeGraphShapes(document, (shape) => {
    if (isImageInputCountNode(shape)) {
      const requiredCount = requiredImageInputCounts.get(shape.id)
      const requiredTextCount = requiredTextInputCounts.get(shape.id)
      if (!requiredCount && !requiredTextCount) return shape
      const nextCount = requiredCount ? Math.min(Math.max(requiredCount, Number(shape.props.data.imageInputCount ?? 1), 1), maxImageInputPorts) : Number(shape.props.data.imageInputCount ?? 1)
      const nextTextCount = requiredTextCount ? Math.min(Math.max(requiredTextCount, Number(shape.props.data.textInputCount ?? 1), 1), maxTextInputPorts) : Number(shape.props.data.textInputCount ?? 1)
      if (Number(shape.props.data.imageInputCount ?? 1) === nextCount && Number(shape.props.data.textInputCount ?? 1) === nextTextCount) return shape
      return updateNodeData(shape, { ...shape.props.data, imageInputCount: nextCount, textInputCount: nextTextCount })
    }
    if (isChatNode(shape)) {
      const requiredImageCount = requiredImageInputCounts.get(shape.id)
      const requiredTextCount = requiredTextInputCounts.get(shape.id)
      const nextImageCount = requiredImageCount ? Math.min(Math.max(requiredImageCount, Number(shape.props.data.imageInputCount ?? 1), 1), maxChatInputPorts) : Number(shape.props.data.imageInputCount ?? 1)
      const nextTextCount = requiredTextCount ? Math.min(Math.max(requiredTextCount, Number(shape.props.data.textInputCount ?? 1), 1), maxChatInputPorts) : Number(shape.props.data.textInputCount ?? 1)
      if (Number(shape.props.data.imageInputCount ?? 1) === nextImageCount && Number(shape.props.data.textInputCount ?? 1) === nextTextCount) return shape
      return updateNodeData(shape, { ...shape.props.data, imageInputCount: nextImageCount, textInputCount: nextTextCount })
    }
    return shape
  })
}

function pruneInvalidRuntimeGraphEdges(document: CanvasDocument): CanvasDocument {
  const runtimeEdges = document.runtimeEdges.filter((edge) => validateRuntimeGraphConnection(document, edge).valid)
  if (runtimeEdges.length === document.runtimeEdges.length) return document
  return withCanvasRuntimeEdges(document, runtimeEdges)
}

function syncImageNodeInputPreviews(document: CanvasDocument): CanvasDocument {
  return mapRuntimeGraphShapes(document, (shape) => {
    if (!isImageNode(shape)) return shape

    const input = document.runtimeEdges.find((edge) => (
      edge.targetShapeId === shape.id &&
      edge.targetPortId === 'image_in' &&
      edge.dataType === 'image'
    ))
    const source = input ? getNodeShape(document, input.sourceShapeId) : null
    const payload = input && source ? getRuntimeImageOutputPayload(document, source, input.sourcePortId) : null

    if (!input || !payload) {
      return hasUpstreamImageData(shape.props.data) ? updateNodeData(shape, clearUpstreamImageData(shape.props.data)) : shape
    }

    return updateNodeData(shape, pruneUndefined({
      ...shape.props.data,
      ...payload,
      crop: payload.crop,
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

function getTargetInputKey(edge: Pick<RuntimeGraphEdge, 'targetPortId' | 'targetShapeId'>) {
  return `${edge.targetShapeId}:${edge.targetPortId}`
}

function getDynamicInputIndex(portId: string, prefix: 'image_in' | 'text_in') {
  if (portId === prefix) return 1
  const match = new RegExp(`^${prefix}_(\\d+)$`).exec(portId)
  if (!match) return 0
  const index = Number(match[1])
  return Number.isFinite(index) && index > 0 ? index : 0
}

function getNextDynamicInputCount(shapeId: string, inputCounts: Map<string, number>, maxIndexes: Map<string, number>, max: number) {
  return Math.min(Math.max((inputCounts.get(shapeId) ?? 0) + 1, (maxIndexes.get(shapeId) ?? 0) + 1, 1), max)
}

function getNodeShape(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card') ?? null
}

function getNodePort(shape: CanvasNodeShape, portId: string) {
  return getResolvedNodePorts(shape.props.nodeType, shape.props.data).find((port) => port.id === portId) ?? null
}

function isImageInputCountNode(shape: CanvasDocument['shapes'][number]): shape is ImageInputCountNodeShape {
  return shape.type === 'node_card' && (shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4')
}

function isImageNode(shape: CanvasDocument['shapes'][number]): shape is CanvasNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'image'
}

function isChatNode(shape: CanvasDocument['shapes'][number]): shape is ChatNodeShape {
  return shape.type === 'node_card' && shape.props.nodeType === 'chat'
}

function hasUpstreamImageData(data: JsonObject) {
  return typeof data.inputSourceEdgeId === 'string'
}

function clearUpstreamImageData(data: JsonObject): JsonObject {
  return pruneUndefined({
    ...data,
    assetId: undefined,
    crop: undefined,
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

function getRuntimeImageOutputPayload(
  document: CanvasDocument,
  source: CanvasNodeShape,
  portId: string,
  visited: Set<string> = new Set()
): JsonObject | null {
  const visitKey = `${source.id}:${portId}`
  if (visited.has(visitKey)) return null
  visited.add(visitKey)

  if (source.props.nodeType === 'image') {
    const input = document.runtimeEdges.find((edge) => (
      edge.targetShapeId === source.id &&
      edge.targetPortId === 'image_in' &&
      edge.dataType === 'image'
    ))
    if (input) {
      const upstream = getNodeShape(document, input.sourceShapeId)
      return upstream ? getRuntimeImageOutputPayload(document, upstream, input.sourcePortId, visited) : null
    }
    return hasUpstreamImageData(source.props.data) ? null : getRuntimeGraphImageNodePayload(source.props.data)
  }
  if (source.props.nodeType === 'image_gen' || source.props.nodeType === 'image_gen_4') {
    return getRuntimeGraphGeneratedOutputPayload(source.props.data, portId)
  }
  return null
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
