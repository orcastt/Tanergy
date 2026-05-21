import type { CanvasDocument, CanvasPoint } from '@/features/canvas-engine'
import {
  addRuntimeGraphEdge,
  addRuntimeGraphEdges,
  removeRuntimeGraphEdge,
  removeRuntimeGraphEdgesForShapes,
  type RuntimeGraphEdge,
} from '@/features/node-runtime/runtimeGraph'
import type { NodePortDataType } from '@/types/nodeRuntime'

export type KonvaRuntimeEdge = RuntimeGraphEdge

export type KonvaRuntimeConnectionEndpoint = {
  portId: string
  shapeId: string
}

export type KonvaRuntimeConnectionPreview = {
  dataType: NodePortDataType
  pointer: { x: number; y: number }
  source: KonvaRuntimeConnectionEndpoint
  sources?: KonvaRuntimeConnectionEndpoint[]
  target?: KonvaRuntimeConnectionEndpoint & {
    point: CanvasPoint
  }
}

export function addKonvaRuntimeEdge(
  document: CanvasDocument,
  edge: Omit<KonvaRuntimeEdge, 'id'>
): CanvasDocument {
  return addRuntimeGraphEdge(document, edge)
}

export function addKonvaRuntimeEdges(
  document: CanvasDocument,
  edges: Omit<KonvaRuntimeEdge, 'id'>[]
): CanvasDocument {
  return addRuntimeGraphEdges(document, edges)
}

export function removeKonvaRuntimeEdgesForShapes(document: CanvasDocument, shapeIds: string[]) {
  return removeRuntimeGraphEdgesForShapes(document, shapeIds)
}

export function removeKonvaRuntimeEdge(document: CanvasDocument, edgeId: string) {
  return removeRuntimeGraphEdge(document, edgeId)
}
