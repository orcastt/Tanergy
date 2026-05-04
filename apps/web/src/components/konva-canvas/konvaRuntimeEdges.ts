import type { CanvasDocument, CanvasRuntimeEdge } from '@/features/canvas-engine'
import { withCanvasRuntimeEdges, withCanvasShapes } from '@/features/canvas-engine'
import { maxImageInputPorts } from '@/features/node-runtime/registry'
import type { NodePortDataType } from '@/types/nodeRuntime'

export type KonvaRuntimeEdge = CanvasRuntimeEdge

export type KonvaRuntimeConnectionEndpoint = {
  portId: string
  shapeId: string
}

export type KonvaRuntimeConnectionPreview = {
  dataType: NodePortDataType
  pointer: { x: number; y: number }
  source: KonvaRuntimeConnectionEndpoint
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
  return syncKonvaImageInputCounts(withCanvasRuntimeEdges(document, runtimeEdges))
}

export function removeKonvaRuntimeEdgesForShapes(document: CanvasDocument, shapeIds: string[]) {
  const selected = new Set(shapeIds)
  return withCanvasRuntimeEdges(document, document.runtimeEdges.filter((edge) => (
    !selected.has(edge.sourceShapeId) && !selected.has(edge.targetShapeId)
  )))
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

function createKonvaRuntimeEdgeId(dataType: NodePortDataType) {
  return `runtime-edge-${dataType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
