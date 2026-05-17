import type {
  AdminAiModelRecord,
  AdminAiPricingRuleRecord,
  AdminAiProviderRouteRecord,
} from './adminAiClient'

export type ModelDraft = {
  capability: string
  costHint: string
  defaultPricingRuleId: string
  defaultTierKey: string
  displayName: string
  enabled: boolean
  estimatedLatency: string
  isDefault: boolean
  parameterSchema: string
  providerKey: string
}

export type RouteDraft = {
  enabled: boolean
  healthStatus: string
  modelKey: string
  priority: string
  providerKey: string
  providerModel: string
  retryPolicy: string
  routeKey: string
  timeoutMs: string
  weight: string
}

export type PricingDraft = {
  billingUnit: string
  creditMultiplier: string
  effectiveFrom: string
  effectiveTo: string
  estimatedCredits: string
  minCredits: string
  modelKey: string
  providerCostFormula: string
  status: string
  tierKey: string
}

export function toModelDraft(model: AdminAiModelRecord): ModelDraft {
  return {
    capability: model.capability,
    costHint: model.costHint,
    defaultPricingRuleId: model.defaultPricingRuleId ?? '',
    defaultTierKey: model.defaultTierKey ?? '',
    displayName: model.displayName,
    enabled: model.enabled,
    estimatedLatency: model.estimatedLatency,
    isDefault: model.isDefault,
    parameterSchema: JSON.stringify(model.parameterSchema, null, 2),
    providerKey: model.providerKey ?? '',
  }
}

export function toRouteDraft(route: AdminAiProviderRouteRecord): RouteDraft {
  return {
    enabled: route.enabled,
    healthStatus: route.healthStatus,
    modelKey: route.modelKey,
    priority: String(route.priority),
    providerKey: route.providerKey,
    providerModel: route.providerModel,
    retryPolicy: JSON.stringify(route.retryPolicy, null, 2),
    routeKey: route.routeKey,
    timeoutMs: String(route.timeoutMs),
    weight: String(route.weight),
  }
}

export function toPricingDraft(rule: AdminAiPricingRuleRecord): PricingDraft {
  return {
    billingUnit: rule.billingUnit,
    creditMultiplier: String(rule.creditMultiplier),
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo ?? '',
    estimatedCredits: String(rule.estimatedCredits),
    minCredits: String(rule.minCredits),
    modelKey: rule.modelKey,
    providerCostFormula: JSON.stringify(rule.providerCostFormula, null, 2),
    status: rule.status,
    tierKey: rule.tierKey ?? '',
  }
}
