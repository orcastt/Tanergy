import type { JsonObject } from '@/types/nodeRuntime'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'

export type AiCapability = 'image_analysis' | 'image_edit' | 'image_generation' | 'image_reference'

export type AiModelOption = {
  capabilities: AiCapability[]
  costHint: string
  displayName: string
  estimatedLatency: string
  id: string
  isDefault: boolean
  isEnabled: boolean
  parameterSchema: JsonObject
  provider: string
}

export type AiModelsResponse = {
  error?: string
  models: AiModelOption[]
  ok: boolean
}

export type AiRunStatus = 'failed' | 'running' | 'succeeded'

export type AiRunRequest = {
  boardId?: string | null
  inputAssetIds?: string[]
  nodeId?: string | null
  nodeType?: string
  params?: JsonObject
  prompt?: string
  runType: 'image_analysis' | 'image_generation'
  selectedModelId?: string | null
}

export type AiRunRecord = {
  boardId?: string | null
  charge: AiRunChargeSummary
  chargedAccountId: string
  chargedScope: AiRunChargeSummary['chargedScope']
  costCredits: number
  costHint: string
  createdAt: string
  entitlementSource: string
  error?: string | null
  inputAssetIds: string[]
  latencyMs: number
  modelId: string
  nodeId?: string | null
  outputAssetIds: string[]
  provider: string
  runId: string
  runType: AiRunRequest['runType']
  status: AiRunStatus
  textOutput?: string | null
  workspaceKind: AiRunChargeSummary['workspaceKind']
  workspaceSeatId?: null | string
}

export type AiRunResponse = {
  error?: string
  ok: boolean
  run?: AiRunRecord
}
