import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'
import { createDefaultNodeData, createDefaultRuntimeSummary, getNodeDefinition } from './registry'

type CreateNodeCardInput = {
  data?: JsonObject
  h?: number
  idHint?: string
  type: NodeType
  w?: number
  x: number
  y: number
}

export function createNodeCard(editor: Editor, input: CreateNodeCardInput): TLShapeId {
  const definition = getNodeDefinition(input.type)
  const id = createShapeId(
    `${input.idHint ?? input.type}-${Date.now()}-${Math.round(Math.random() * 1000)}`
  )

  editor.createShape<NodeCardShape>({
    id,
    type: 'node_card',
    x: input.x,
    y: input.y,
    props: {
      data: { ...createDefaultNodeData(input.type), ...input.data },
      h: input.h ?? getDefaultNodeHeight(input.type),
      nodeId: `${input.type}-${id.slice(-6)}`,
      nodeType: input.type,
      runtimeSummary: createDefaultRuntimeSummary(input.type),
      version: definition.version,
      w: input.w ?? getDefaultNodeWidth(input.type),
    },
  })

  return id
}

function getDefaultNodeWidth(type: NodeType) {
  if (type === 'image') return 420
  if (type === 'image_gen' || type === 'image_gen_4') return 330
  if (type === 'analysis') return 330
  return 300
}

function getDefaultNodeHeight(type: NodeType) {
  if (type === 'image') return 240
  if (type === 'image_gen_4') return 350
  if (type === 'image_gen') return 320
  if (type === 'analysis') return 340
  return 220
}
