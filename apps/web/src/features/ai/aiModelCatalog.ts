import type { AiCapability, AiModelOption } from './aiTypes'
import {
  gptImage2AspectRatios,
  gptImage2Resolutions,
  nanoBananaAspectRatios,
  nanoBananaImageSizes,
  seedreamSizeValues,
} from './aiImageModelContracts'

const qwqPlusLatestModelId = 'qwq-plus-latest'
const qwenVisionModelId = 'qwen/qwen2.5-vl-72b-instruct'

const fallbackAiModels: AiModelOption[] = [
  {
    capabilities: ['text'],
    costHint: 'GeekAI streaming chat default for canvas chat and prompt optimization.',
    defaultTierKey: null,
    displayName: 'QwQ Plus Latest',
    estimatedLatency: '2-8s',
    id: qwqPlusLatestModelId,
    isDefault: true,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
    tierOptions: [],
  },
  {
    capabilities: ['text'],
    costHint: 'GeekAI fallback text model kept for operator rollback.',
    defaultTierKey: null,
    displayName: 'DeepSeek V3.1',
    estimatedLatency: '1-4s',
    id: 'deepseek/deepseek-v3.1',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
    tierOptions: [],
  },
  {
    capabilities: ['text', 'image_analysis'],
    costHint: 'Higher-context multimodal fallback for harder visual reasoning.',
    defaultTierKey: null,
    displayName: 'Qwen 2.5 VL 72B',
    estimatedLatency: '2-8s',
    id: qwenVisionModelId,
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'geekai',
    tierOptions: [],
  },
  {
    capabilities: ['image_generation', 'image_edit'],
    costHint: 'GeekAI GPT Image 2 with tested 1K, 2K, and 4K render tiers.',
    defaultTierKey: '1k',
    displayName: 'GPT Image 2',
    estimatedLatency: '5-12s',
    id: 'gpt-image-2',
    isDefault: true,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: [...gptImage2AspectRatios],
      resolution: [...gptImage2Resolutions],
    },
    provider: 'geekai',
    tierOptions: [
      { key: '1k', label: '1K', parameterKey: 'resolution' },
      { key: '2k', label: '2K', parameterKey: 'resolution' },
      { key: '4k', label: '4K', parameterKey: 'resolution' },
    ],
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'GeekAI Nano Banana 2 with common and extended aspect ratios.',
    defaultTierKey: '1k',
    displayName: 'Nano Banana 2',
    estimatedLatency: '4-10s',
    id: 'nano-banana-2',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: [...nanoBananaAspectRatios],
      imageSize: [...nanoBananaImageSizes],
    },
    provider: 'geekai',
    tierOptions: [
      { key: '0_5k', label: '0.5K', parameterKey: 'imageSize' },
      { key: '1k', label: '1K', parameterKey: 'imageSize' },
      { key: '2k', label: '2K', parameterKey: 'imageSize' },
      { key: '4k', label: '4K', parameterKey: 'imageSize' },
    ],
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'ByteDance Seedream 5.0 Lite with high-resolution generation and reference image support.',
    defaultTierKey: null,
    displayName: 'Doubao Seedream 5.0 Lite',
    estimatedLatency: '6-18s',
    id: 'doubao-seedream-5.0-lite',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      seedreamSize: [...seedreamSizeValues],
    },
    provider: 'geekai',
    tierOptions: [],
  },
]

export function normalizeAiModelId(modelId: null | string | undefined) {
  const normalized = modelId?.trim()
  if (!normalized) return null
  return normalized
}

export function getAiModels(capability?: AiCapability) {
  return capability
    ? fallbackAiModels.filter((model) => model.capabilities.includes(capability))
    : fallbackAiModels
}

export function getDefaultImageModelId() {
  return getAiModels('image_generation').find((model) => model.isDefault && model.isEnabled)?.id
    ?? getAiModels('image_generation')[0]?.id
    ?? fallbackAiModels[0].id
}

export function getDefaultChatModelId() {
  return getChatCapableModels().find((model) => model.id === qwqPlusLatestModelId && model.isEnabled)?.id
    ?? getChatCapableModels().find((model) => model.isDefault && model.isEnabled)?.id
    ?? getChatCapableModels().find((model) => model.isEnabled)?.id
    ?? fallbackAiModels[0].id
}

export function getDefaultAnalysisModelId() {
  return getAiModels('image_analysis').find((model) => model.id === qwenVisionModelId && model.isEnabled)?.id
    ?? getAiModels('image_analysis').find((model) => model.isDefault && model.isEnabled)?.id
    ?? getAiModels('image_analysis').find((model) => model.isEnabled)?.id
    ?? fallbackAiModels[0].id
}

export function getDefaultPromptOptimizerModelId() {
  return getPromptOptimizerModels().find((model) => model.id === qwqPlusLatestModelId && model.isEnabled)?.id
    ?? getPromptOptimizerModels().find((model) => model.isEnabled)?.id
    ?? fallbackAiModels[0].id
}

export function getImageModelSelectOptions() {
  return getAiModels('image_generation').map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function getChatModelSelectOptions() {
  return getChatCapableModels().map((model) => ({
    disabled: !model.isEnabled,
    label: model.displayName,
    value: model.id,
  }))
}

export function getPromptOptimizerModelSelectOptions() {
  return getPromptOptimizerModels().map((model) => ({
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
  return getAiModels('text').find((model) => model.id === normalizeAiModelId(modelId))?.displayName ?? 'Model'
}

export function getAnalysisModelDisplayName(modelId: null | string | undefined) {
  return getAiModels('image_analysis').find((model) => model.id === normalizeAiModelId(modelId))?.displayName ?? 'Model'
}

export function getAiModelDefinition(modelId: null | string | undefined) {
  const normalizedModelId = normalizeAiModelId(modelId)
  const model = fallbackAiModels.find((item) => item.id === normalizedModelId) ?? fallbackAiModels.find((item) => item.isDefault)
  if (!model || !model.isEnabled) throw new Error('The selected AI model is unavailable.')
  return model
}

function getChatCapableModels() {
  return getAiModels('text')
}

function getPromptOptimizerModels() {
  return getAiModels('text')
}
