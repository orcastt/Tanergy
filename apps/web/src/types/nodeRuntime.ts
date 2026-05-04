import type { JsonValue } from '@tldraw/utils'

export type NodeType = 'prompt' | 'image_gen' | 'image_gen_4' | 'analysis' | 'image'

export type NodePortDirection = 'in' | 'out'

export type NodePortDataType = 'text' | 'image'

export type NodeRunStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export type JsonObject = Record<string, JsonValue>

export type NodeCategory = 'image' | 'text' | 'transform' | 'utility'

export type NodePortDefinition = {
  dataType: NodePortDataType
  direction: NodePortDirection
  id: string
  label: string
  multiple?: boolean
  required?: boolean
}

export type ResolvedNodePort = NodePortDefinition & {
  anchorY: number
}

export type NodeDefinition = {
  accentColor: string
  aiDescription: string
  aiName: string
  aiUseCases: string[]
  cardFields: NodeCardField[]
  category: NodeCategory
  defaultData: JsonObject
  defaultCardSize: {
    height: number
    width: number
  }
  defaultRuntimeCostHint?: string | null
  displayName: string
  outputSummary: string
  paletteOrder: number
  paletteShortLabel: string
  ports: NodePortDefinition[]
  runnable?: boolean
  type: NodeType
  version: number
}

export type NodeCardField = {
  label: string
  name: string
  options?: { label: string; value: string | number }[]
  type: 'text' | 'textarea' | 'select' | 'number'
}

export type NodeRuntimeSummary = JsonObject & {
  costHint: string | null
  error: string | null
  lastRunId: string | null
  resultAssetIds: string[]
  status: NodeRunStatus
}

export type NodeCardShapeData = {
  data: JsonObject
  nodeId: string
  nodeType: NodeType
  runtimeSummary: NodeRuntimeSummary
  version: number
}
