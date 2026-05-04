import type { CanvasDocument, CanvasPoint, CanvasRuntimeEdge } from '@/features/canvas-engine'
import { withCanvasRuntimeEdges, withCanvasShapes } from '@/features/canvas-engine'
import { maxImageInputPorts } from '@/features/node-runtime/registry'
import type { JsonObject, NodePortDataType } from '@/types/nodeRuntime'

export type KonvaRuntimeEdge = CanvasRuntimeEdge

export type KonvaRuntimeConnectionEndpoint = {
  portId: string
  shapeId: string
}

export type KonvaRuntimeConnectionPreview = {
  dataType: NodePortDataType
  pointer: { x: number; y: number }
  source: KonvaRuntimeConnectionEndpoint
  target?: KonvaRuntimeConnectionEndpoint & {
    point: CanvasPoint
  }
}

export function addKonvaRuntimeEdge(
  document: CanvasDocument,
  edge: Omit<KonvaRuntimeEdge, 'id'>
): CanvasDocument {
  const runtimeEdge = { ...edge, id: createKonvaRuntimeEdgeId(edge.dataType) }
  const runtimeEdges = [
    ...document.runtimeEdges.filter((item) => !(
      item.targetShapeId === edge.targetShapeId &&
      item.targetPortId === edge.targetPortId
    )),
    runtimeEdge,
  ]
  return syncKonvaNodeInputs(syncKonvaImageInputCounts(withCanvasRuntimeEdges(document, runtimeEdges)))
}

export function removeKonvaRuntimeEdgesForShapes(document: CanvasDocument, shapeIds: string[]) {
  const selected = new Set(shapeIds)
  return syncKonvaNodeInputs(syncKonvaImageInputCounts(withCanvasRuntimeEdges(document, document.runtimeEdges.filter((edge) => (
    !selected.has(edge.sourceShapeId) && !selected.has(edge.targetShapeId)
  )))))
}

export function removeKonvaRuntimeEdge(document: CanvasDocument, edgeId: string) {
  return syncKonvaNodeInputs(syncKonvaImageInputCounts(withCanvasRuntimeEdges(document, document.runtimeEdges.filter((edge) => edge.id !== edgeId))))
}

function syncKonvaImageInputCounts(document: CanvasDocument): CanvasDocument {
  const imageInputCounts = new Map<string, number>()
  for (const edge of document.runtimeEdges) {
    if (edge.dataType !== 'image') continue
    imageInputCounts.set(edge.targetShapeId, (imageInputCounts.get(edge.targetShapeId) ?? 0) + 1)
  }

  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.type !== 'node_card') return shape
    if (shape.props.nodeType !== 'image_gen' && shape.props.nodeType !== 'image_gen_4') return shape
    const nextCount = Math.min(Math.max((imageInputCounts.get(shape.id) ?? 0) + 1, 1), maxImageInputPorts)
    if (Number(shape.props.data.imageInputCount ?? 1) === nextCount) return shape
    return {
      ...shape,
      props: {
        ...shape.props,
        data: {
          ...shape.props.data,
          imageInputCount: nextCount,
        },
      },
    }
  }))
}

function syncKonvaNodeInputs(document: CanvasDocument): CanvasDocument {
  const shapeById = new Map(document.shapes.map((shape) => [shape.id, shape]))
  return withCanvasShapes(document, document.shapes.map((shape) => {
    if (shape.type !== 'node_card' || shape.props.nodeType !== 'image') return shape
    const input = document.runtimeEdges.find((edge) => edge.targetShapeId === shape.id && edge.targetPortId === 'image_in' && edge.dataType === 'image')
    const source = input ? shapeById.get(input.sourceShapeId) : null
    if (!input || !source || source.type !== 'node_card') {
      return hasUpstreamImageData(shape.props.data) ? {
        ...shape,
        props: {
          ...shape.props,
          data: clearUpstreamImageData(shape.props.data),
        },
      } : shape
    }
    const payload = getImageNodePayload(source.props.data)
    if (!payload) {
      return hasUpstreamImageData(shape.props.data) ? {
        ...shape,
        props: {
          ...shape.props,
          data: clearUpstreamImageData(shape.props.data),
        },
      } : shape
    }
    return {
      ...shape,
      props: {
        ...shape.props,
        data: pruneUndefined({
          ...shape.props.data,
          ...payload,
          inputSourceEdgeId: input.id,
        }),
      },
    }
  }))
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

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}

function createKonvaRuntimeEdgeId(dataType: NodePortDataType) {
  return `runtime-edge-${dataType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
