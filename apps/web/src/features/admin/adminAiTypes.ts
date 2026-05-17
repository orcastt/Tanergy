export type AdminAiModelRecord = {
  capabilities: string[]
  capability: string
  costHint: string
  createdAt: string
  defaultPricingRuleId?: null | string
  defaultTierKey?: null | string
  displayName: string
  enabled: boolean
  estimatedLatency: string
  isDefault: boolean
  modelKey: string
  parameterSchema: Record<string, unknown>
  providerKey?: null | string
  updatedAt: string
}

export type AdminAiProviderRouteRecord = {
  createdAt: string
  enabled: boolean
  healthStatus: string
  modelKey: string
  priority: number
  providerKey: string
  providerModel: string
  retryPolicy: Record<string, unknown>
  routeId: string
  routeKey: string
  timeoutMs: number
  updatedAt: string
  weight: number
}

export type AdminAiPricingRuleRecord = {
  billingUnit: string
  createdAt: string
  creditMultiplier: number
  effectiveFrom: string
  effectiveTo?: null | string
  estimatedCredits: number
  id: string
  minCredits: number
  modelKey: string
  providerCostFormula: Record<string, unknown>
  status: string
  tierKey?: null | string
  updatedAt: string
}

export type AdminAiRunRecord = {
  boardId?: null | string
  chargedAccountId?: null | string
  chargedScope?: null | string
  costCredits: number
  createdAt: string
  errorMessage?: null | string
  estimatedCredits: number
  id: string
  inputAssetIds: string[]
  latencyMs: number
  modelId: string
  nodeId?: null | string
  outputAssetIds: string[]
  preflightStatus?: null | string
  pricingRuleId?: null | string
  promptPreview?: null | string
  provider: string
  providerCost?: null | number
  providerCurrency?: null | string
  routeId?: null | string
  routeKey?: null | string
  runType: string
  selectedTierKey?: null | string
  status: string
  updatedAt: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminAiApiCallRecord = {
  boardId?: null | string
  createdAt: string
  creditsCharged: number
  creditsRefunded: number
  errorCode?: null | string
  id: string
  latencyMs: number
  modelId: string
  nodeId?: null | string
  pricingRuleId?: null | string
  provider: string
  providerCost?: null | number
  providerCurrency?: null | string
  routeId?: null | string
  routeKey?: null | string
  runId: string
  status: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminAiRouteMetricRecord = {
  averageAttemptsPerRun: number
  avgLatencyMs: number
  calls: number
  capability: string
  creditsCharged: number
  directWinRate?: null | number
  directWins: number
  failedCalls: number
  fallbackWins: number
  lastCalledAt?: null | string
  modelId: string
  provider: string
  providerCost: number
  providerCurrency?: null | string
  routeAttemptSuccessRate?: null | number
  routeHitRuns: number
  routeId?: null | string
  routeKey: string
  succeededCalls: number
  terminalFailures: number
}

export type AdminAiRouteMetricsTotals = {
  averageAttemptsPerRun: number
  calls: number
  creditsCharged: number
  directWinRate?: null | number
  directWins: number
  failedCalls: number
  fallbackWins: number
  providerCost: number
  routeAttemptSuccessRate?: null | number
  routeHitRuns: number
  succeededCalls: number
  terminalFailures: number
}

export type AdminAiModelsResource = { error?: string; models: AdminAiModelRecord[]; ok: boolean }
export type AdminAiModelMutationResource = { error?: string; model?: AdminAiModelRecord; ok: boolean }
export type AdminAiProviderRoutesResource = { error?: string; ok: boolean; routes: AdminAiProviderRouteRecord[] }
export type AdminAiProviderRouteMutationResource = { error?: string; ok: boolean; route?: AdminAiProviderRouteRecord }
export type AdminAiPricingRulesResource = { error?: string; ok: boolean; pricingRules: AdminAiPricingRuleRecord[] }
export type AdminAiPricingRuleMutationResource = { error?: string; ok: boolean; pricingRule?: AdminAiPricingRuleRecord }
export type AdminAiRunsResource = { error?: string; ok: boolean; runs: AdminAiRunRecord[] }
export type AdminAiApiCallsResource = { apiCalls: AdminAiApiCallRecord[]; error?: string; ok: boolean }

export type AdminAiRouteMetricsResource = {
  error?: string
  metrics: AdminAiRouteMetricRecord[]
  ok: boolean
  totals: AdminAiRouteMetricsTotals
}

export type AdminAiControlPlaneVersionRecord = {
  action: string
  actorUserId?: null | string
  createdAt: string
  id: string
  note?: null | string
  publishedAt?: null | string
  resourceId: string
  resourceType: string
  snapshot: Record<string, unknown>
  versionNumber: number
  workspaceId?: null | string
}

export type AdminAiControlPlaneVersionsResource = { error?: string; ok: boolean; versions: AdminAiControlPlaneVersionRecord[] }
export type AdminAiVersionMutationResource = { error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }

export type AdminAiModelUpdateInput = Partial<Pick<
  AdminAiModelRecord,
  'capabilities' | 'capability' | 'costHint' | 'defaultPricingRuleId' | 'defaultTierKey' | 'displayName' | 'enabled' | 'estimatedLatency' | 'isDefault' | 'parameterSchema' | 'providerKey'
>>

export type AdminAiProviderRouteUpdateInput = Partial<Pick<
  AdminAiProviderRouteRecord,
  'enabled' | 'healthStatus' | 'modelKey' | 'priority' | 'providerKey' | 'providerModel' | 'retryPolicy' | 'routeKey' | 'timeoutMs' | 'weight'
>>

export type AdminAiPricingRuleUpdateInput = Partial<Pick<
  AdminAiPricingRuleRecord,
  'billingUnit' | 'creditMultiplier' | 'effectiveFrom' | 'effectiveTo' | 'estimatedCredits' | 'minCredits' | 'modelKey' | 'providerCostFormula' | 'status' | 'tierKey'
>>

export type AdminAiModelQuery = {
  capability?: string
  enabled?: boolean
  limit?: number
}

export type AdminAiProviderRouteQuery = {
  enabled?: boolean
  limit?: number
  modelKey?: string
  providerKey?: string
}

export type AdminAiPricingRuleQuery = {
  limit?: number
  modelKey?: string
  status?: string
  tierKey?: string
}

export type AdminAiRunQuery = {
  boardId?: string
  limit?: number
  modelId?: string
  preflightStatus?: string
  pricingRuleId?: string
  provider?: string
  routeId?: string
  routeKey?: string
  runId?: string
  runType?: string
  status?: string
  workspaceId?: string
}

export type AdminAiApiCallQuery = {
  boardId?: string
  errorCode?: string
  limit?: number
  modelId?: string
  provider?: string
  pricingRuleId?: string
  routeId?: string
  routeKey?: string
  runId?: string
  status?: string
  workspaceId?: string
}

export type AdminAiVersionQuery = {
  limit?: number
  resourceId: string
  resourceType: string
}
