import type { JsonObject } from '@/types/nodeRuntime'
import type { AiCapability, AiModelOption, AiRunRecord, AiRunRequest } from './aiTypes'

export const mockAiModels: AiModelOption[] = [
  {
    capabilities: ['image_generation', 'image_edit'],
    costHint: 'Use low quality for early tests.',
    displayName: 'GPT Image 2',
    estimatedLatency: '5-12s',
    id: 'gpt-image-2',
    isDefault: true,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: ['auto', '1:1', '4:3', '16:9', '3:2'],
      resolution: ['0.5K', '1K', '2K'],
    },
    provider: 'geekai',
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'Use 0.5K for fast mock validation.',
    displayName: 'Gemini 3.1 Flash Image Preview',
    estimatedLatency: '4-10s',
    id: 'gemini-3.1-flash-image-preview',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: ['auto', '1:1', '4:3', '16:9'],
      resolution: ['0.5K', '1K', '2K', '4K'],
    },
    provider: 'geekai',
  },
]

export function getAiModels(capability?: AiCapability) {
  return capability
    ? mockAiModels.filter((model) => model.capabilities.includes(capability))
    : mockAiModels
}

export function getDefaultImageModelId() {
  return mockAiModels.find((model) => model.isDefault && model.isEnabled)?.id ?? mockAiModels[0].id
}

export function getImageModelSelectOptions() {
  return getAiModels('image_generation').map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function createMockAiRun(input: AiRunRequest, runId = createRunId()): AiRunRecord {
  const model = findModel(input.selectedModelId)
  const prompt = input.prompt?.trim() || 'Untitled prompt'
  const inputAssetIds = input.inputAssetIds ?? []
  const count = input.runType === 'image_generation' ? clampCount(Number(input.params?.count ?? 1)) : 0
  const outputAssetIds = input.runType === 'image_generation'
    ? Array.from({ length: count }, (_, index) => createMockAssetId(runId, index, prompt, inputAssetIds.length))
    : []

  return {
    boardId: input.boardId ?? null,
    costCredits: 0,
    costHint: 'Mock AI run · no credits charged',
    createdAt: new Date().toISOString(),
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
      : null,
  }
}

function findModel(modelId: string | null | undefined) {
  const model = mockAiModels.find((item) => item.id === modelId) ?? mockAiModels.find((item) => item.isDefault)
  if (!model || !model.isEnabled) throw new Error('The selected image model is unavailable.')
  return model
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
