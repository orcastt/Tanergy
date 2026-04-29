import type { JsonValue } from '@tldraw/utils'

export type NodeType = 'prompt' | 'image_gen' | 'image_gen_4' | 'analysis' | 'image'

export type NodePortDirection = 'in' | 'out'

export type NodePortDataType = 'text' | 'image'

export type NodeRunStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export type JsonObject = Record<string, JsonValue>

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
  defaultData: JsonObject
  displayName: string
  inspectorFields: NodeInspectorField[]
  outputSummary: string
  ports: NodePortDefinition[]
  type: NodeType
  version: number
}

export type NodeInspectorField = {
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
