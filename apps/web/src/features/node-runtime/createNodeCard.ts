import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'
import { createDefaultNodeData, createDefaultRuntimeSummary, getDefaultNodeCardSize, getNodeDefinition } from './registry'

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
  const defaultSize = getDefaultNodeCardSize(input.type)
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
      h: input.h ?? defaultSize.height,
      nodeId: `${input.type}-${id.slice(-6)}`,
      nodeType: input.type,
      runtimeSummary: createDefaultRuntimeSummary(input.type),
      version: definition.version,
      w: input.w ?? defaultSize.width,
    },
  })

  return id
}
