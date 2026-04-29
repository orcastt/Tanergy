import type { JsonValue } from '@tldraw/utils'
import type { TLBaseShape } from 'tldraw'
import type { NodeType } from './nodeRuntime'

export type NodeCardShape = TLBaseShape<
  'node_card',
  {
    data: JsonValue
    h: number
    nodeId: string
    nodeType: NodeType
    runtimeSummary: JsonValue
    version: number
    w: number
  }
>
