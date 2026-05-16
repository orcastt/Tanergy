import type { JsonObject } from '@/types/nodeRuntime'
import { createLocalAiChargeSummary } from '@/features/billing/billingContracts'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type { AiRunRecord, AiRunRequest } from './aiTypes'
import { getAiModelDefinition } from './aiModelCatalog'

export {
  getAiModelDefinition,
  getAiModels,
  getAnalysisModelDisplayName,
  getAnalysisModelSelectOptions,
  getChatModelDisplayName,
  getChatModelSelectOptions,
  getDefaultAnalysisModelId,
  getDefaultChatModelId,
  getDefaultImageModelId,
  getDefaultPromptOptimizerModelId,
  getImageModelSelectOptions,
  getPromptOptimizerModelSelectOptions,
  normalizeAiModelId,
} from './aiModelCatalog'

export function createMockAiRun(
  input: AiRunRequest,
  runId = createRunId(),
  charge: AiRunChargeSummary = createLocalAiChargeSummary(getCurrentSessionSnapshot())
): AiRunRecord {
  const model = getAiModelDefinition(input.selectedModelId)
  const prompt = input.prompt?.trim() || 'Untitled prompt'
  const inputAssetIds = input.inputAssetIds ?? []
  const count = input.runType === 'image_generation' ? clampCount(Number(input.params?.count ?? 1)) : 0
  const outputAssetIds = input.runType === 'image_generation'
    ? Array.from({ length: count }, (_, index) => createMockAssetId(runId, index, prompt, inputAssetIds.length))
    : []

  return {
    boardId: input.boardId ?? null,
    charge,
    chargedAccountId: charge.chargedAccountId,
    chargedScope: charge.chargedScope,
    costCredits: 0,
    costHint: `Mock AI run · ${charge.payerLabel}`,
    createdAt: new Date().toISOString(),
    entitlementSource: charge.entitlementSource,
    error: null,
    inputAssetIds,
    latencyMs: input.runType === 'image_generation' ? 450 : 180,
    modelId: model.id,
    nodeId: input.nodeId ?? null,
    outputAssetIds,
    provider: model.provider,
    runId,
    runType: input.runType,
    status: 'succeeded',
    textOutput: input.runType === 'image_analysis'
      ? createMockAnalysisText(prompt, inputAssetIds)
      : input.runType === 'text'
        ? createMockTextOutput(prompt, input.systemPrompt ?? input.params?.systemPrompt)
        : null,
    workspaceKind: charge.workspaceKind,
    workspaceSeatId: charge.workspaceSeatId ?? null,
  }
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(4, Math.round(value)))
}

function createMockAssetId(runId: string, index: number, prompt: string, refCount: number) {
  return `asset_mock_${runId}_${index + 1}_${slugify(prompt)}_refs${refCount}`
}

function createMockAnalysisText(prompt: string, inputAssetIds: string[]) {
  const assetList = inputAssetIds.join(', ') || 'none'
  return `Mock analysis: read ${inputAssetIds.length} image(s). Reverse prompt: ${prompt}. Source assets: ${assetList}`
}

function createMockTextOutput(prompt: string, systemPrompt: unknown) {
  const normalizedSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt.toLowerCase() : ''
  if (normalizedSystemPrompt.includes('prompt optimizer')) {
    return `${prompt}. Cinematic composition, realistic materials, clean subject separation, layered lighting, rich color contrast, and polished production detail.`
  }
  return `Optimized text output: ${prompt}`
}

function createRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_mock_${globalThis.crypto.randomUUID()}`
  return `run_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'prompt'
}

export function asAiRunParams(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
