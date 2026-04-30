import { create } from 'zustand'
import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { maxImageInputPorts } from './registry'

export type NodeRuntimeEdge = {
  dataType: NodePortDataType
  id: string
  sourcePortId: string
  sourceShapeId: string
  targetPortId: string
  targetShapeId: string
}

type NodeEdgeState = {
  addEdge: (edge: Omit<NodeRuntimeEdge, 'id'>) => NodeRuntimeEdge
  edges: NodeRuntimeEdge[]
  removeEdge: (id: string) => void
}

export const useNodeEdgeStore = create<NodeEdgeState>((set) => ({
  addEdge: (edge) => {
    const nextEdge = { ...edge, id: createEdgeId() }
    set((state) => ({
      edges: [
        ...state.edges.filter((item) => !(
          item.sourceShapeId === edge.sourceShapeId &&
          item.sourcePortId === edge.sourcePortId &&
          item.targetShapeId === edge.targetShapeId &&
          item.targetPortId === edge.targetPortId
        )),
        nextEdge,
      ],
    }))
    return nextEdge
  },
  edges: [],
  removeEdge: (id) => set((state) => ({ edges: state.edges.filter((edge) => edge.id !== id) })),
}))

export function getNodeEdgesSnapshot() {
  return useNodeEdgeStore.getState().edges
}

export function syncNodeEdgeInputCounts(editor: Editor) {
  const imageCounts = new Map<string, number>()
  for (const edge of getNodeEdgesSnapshot()) {
    if (edge.dataType !== 'image') continue
    imageCounts.set(edge.targetShapeId, (imageCounts.get(edge.targetShapeId) ?? 0) + 1)
  }

  for (const shape of editor.getCurrentPageShapes()) {
    if (!isNodeCard(shape)) continue
    if (shape.props.nodeType !== 'image_gen' && shape.props.nodeType !== 'image_gen_4') continue

    const data = shape.props.data && typeof shape.props.data === 'object' && !Array.isArray(shape.props.data)
      ? shape.props.data
      : {}
    const nextCount = Math.min(Math.max((imageCounts.get(shape.id) ?? 0) + 1, 1), maxImageInputPorts)
    if (Number(data.imageInputCount ?? 1) === nextCount) continue

    editor.updateShape<NodeCardShape>({
      id: shape.id,
      props: { data: { ...data, imageInputCount: nextCount } },
      type: 'node_card',
    })
  }
}

function createEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
