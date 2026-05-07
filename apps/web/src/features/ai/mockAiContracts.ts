import type { JsonObject } from '@/types/nodeRuntime'
import { createLocalAiChargeSummary } from '@/features/billing/billingContracts'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type { AiCapability, AiModelOption, AiRunRecord, AiRunRequest } from './aiTypes'

export const mockAiModels: AiModelOption[] = [
  {
    capabilities: ['text'],
    costHint: 'Fast streaming chat for node conversations.',
    displayName: 'Hunyuan 3.0 Preview',
    estimatedLatency: '1-4s',
    id: 'hunyuan-3.0-preview',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
  },
  {
    capabilities: ['text', 'image_analysis'],
    costHint: 'Balanced multimodal model for chat and image analysis.',
    displayName: 'GPT-5 Mini',
    estimatedLatency: '1-4s',
    id: 'gpt-5-mini',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
  },
  {
    capabilities: ['image_analysis'],
    costHint: 'Fast vision analysis for image prompt extraction and comparisons.',
    displayName: 'GPT-4o Mini',
    estimatedLatency: '1-4s',
    id: 'gpt-4o-mini',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
  },
  {
    capabilities: ['image_analysis'],
    costHint: 'Gemini vision analysis through GeekAI chat completions.',
    displayName: 'Gemini 2.5 Flash Vision',
    estimatedLatency: '1-4s',
    id: 'gemini-2.5-flash',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
  },
  {
    capabilities: ['image_generation', 'image_edit'],
    costHint: 'Use low quality for early tests.',
    displayName: 'GPT Image 2',
    estimatedLatency: '5-12s',
    id: 'gpt-image-2',
    isDefault: true,
    isEnabled: true,
    parameterSchema: {
      quality: ['low', 'medium', 'high'],
      size: ['1024x1024', '1024x1536', '1536x1024'],
    },
    provider: 'geekai',
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'Nano Banana 2 backend for fast image generation and edits.',
    displayName: 'Nano Banana 2',
    estimatedLatency: '4-10s',
    id: 'gemini-3.1-flash-image-preview',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '9:21', '1:4', '4:1', '1:8', '8:1'],
      imageSize: ['0.5K', '1K', '2K', '4K'],
    },
    provider: 'geekai',
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'ByteDance Seedream 5.0 Lite with high-resolution generation and reference image support.',
    displayName: 'Doubao Seedream 5.0 Lite',
    estimatedLatency: '6-18s',
    id: 'doubao-seedream-5.0-lite',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      outputFormat: ['png', 'jpeg'],
      size: ['2K', '3K', '4K', '2048x2048', '2304x1728', '1728x2304', '2848x1600', '1600x2848', '2496x1664', '1664x2496', '3136x1344', '3072x3072', '3456x2592', '2592x3456', '4096x2304', '2304x4096', '3744x2496', '2496x3744', '4704x2016', '4096x4096', '3520x4704', '4704x3520', '5504x3040', '3040x5504', '3328x4992', '4992x3328', '6240x2656'],
    },
    provider: 'geekai',
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'Jimeng Image 4.0 for text-to-image, image editing, and Chinese prompt generation.',
    displayName: 'Jimeng Image 4.0',
    estimatedLatency: '6-18s',
    id: 'jimeng_t2i_v40',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      size: ['1024x1024', '2048x2048', '2304x1728', '2560x1440', '2496x1664', '3024x1296', '4096x4096', '4694x3520', '4992x3328', '5404x3040', '6198x2656'],
      strength: [0.3, 0.5, 0.7, 0.9],
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
  return getAiModels('image_generation').find((model) => model.isDefault && model.isEnabled)?.id
    ?? getAiModels('image_generation')[0]?.id
    ?? mockAiModels[0].id
}

export function getDefaultChatModelId() {
  return getAiModels('text').find((model) => model.id === 'hunyuan-3.0-preview' && model.isEnabled)?.id
    ?? getAiModels('text').find((model) => model.isEnabled)?.id
    ?? mockAiModels[0].id
}

export function getDefaultAnalysisModelId() {
  return getAiModels('image_analysis').find((model) => model.id === 'gpt-5-mini' && model.isEnabled)?.id
    ?? getAiModels('image_analysis').find((model) => model.isEnabled)?.id
    ?? mockAiModels[0].id
}

export function getImageModelSelectOptions() {
  return getAiModels('image_generation').map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function getChatModelSelectOptions() {
  return getAiModels('text').map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function getAnalysisModelSelectOptions() {
  return getAiModels('image_analysis').map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function getChatModelDisplayName(modelId: null | string | undefined) {
  return getAiModels('text').find((model) => model.id === modelId)?.displayName ?? 'Model'
}

export function getAnalysisModelDisplayName(modelId: null | string | undefined) {
  return getAiModels('image_analysis').find((model) => model.id === modelId)?.displayName ?? 'Model'
}

export function getAiModelDefinition(modelId: null | string | undefined) {
  return findModel(modelId)
}

export function createMockAiRun(
  input: AiRunRequest,
  runId = createRunId(),
  charge: AiRunChargeSummary = createLocalAiChargeSummary(getCurrentSessionSnapshot())
): AiRunRecord {
  const model = findModel(input.selectedModelId)
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
      : null,
    workspaceKind: charge.workspaceKind,
    workspaceSeatId: charge.workspaceSeatId ?? null,
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
