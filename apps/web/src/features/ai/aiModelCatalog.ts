import type { AiCapability, AiModelOption } from './aiTypes'

const fallbackAiModels: AiModelOption[] = [
  {
    capabilities: ['text', 'image_analysis'],
    costHint: 'Low-cost multimodal OCR and document understanding for chat and visual analysis.',
    defaultTierKey: null,
    displayName: 'DeepSeek OCR 2',
    estimatedLatency: '1-4s',
    id: 'deepseek/deepseek-ocr-2',
    isDefault: true,
    isEnabled: true,
    parameterSchema: {},
    provider: 'jiekou',
    tierOptions: [],
  },
  {
    capabilities: ['text'],
    costHint: 'Fast text reasoning for prompt optimization and general chat.',
    defaultTierKey: null,
    displayName: 'DeepSeek V3.1',
    estimatedLatency: '1-4s',
    id: 'deepseek/deepseek-v3.1',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'jiekou',
    tierOptions: [],
  },
  {
    capabilities: ['text', 'image_analysis'],
    costHint: 'Higher-context multimodal fallback for harder visual reasoning.',
    defaultTierKey: null,
    displayName: 'Qwen 2.5 VL 72B',
    estimatedLatency: '2-8s',
    id: 'qwen/qwen2.5-vl-72b-instruct',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {},
    provider: 'jiekou',
    tierOptions: [],
  },
  {
    capabilities: ['image_generation', 'image_edit'],
    costHint: 'Aspect ratio UI maps to the supported Jiekou GPT Image 2 render tiers.',
    defaultTierKey: '1k',
    displayName: 'GPT Image 2',
    estimatedLatency: '5-12s',
    id: 'gpt-image-2',
    isDefault: true,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', '9:21', '2:1', '1:2', '3:1', '1:3'],
      resolution: ['1K', '2K', '4K'],
    },
    provider: 'jiekou',
    tierOptions: [
      { key: '1k', label: '1K', parameterKey: 'resolution' },
      { key: '2k', label: '2K', parameterKey: 'resolution' },
      { key: '4k', label: '4K', parameterKey: 'resolution' },
    ],
  },
  {
    capabilities: ['image_generation', 'image_edit', 'image_reference'],
    costHint: 'Nano Banana 2 backend for fast image generation and edits.',
    defaultTierKey: '1k',
    displayName: 'Nano Banana 2',
    estimatedLatency: '4-10s',
    id: 'nano-banana-2',
    isDefault: false,
    isEnabled: true,
    parameterSchema: {
      aspectRatio: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
      imageSize: ['0.5K', '1K', '2K', '4K'],
    },
    provider: 'jiekou',
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
      seedreamSize: ['2K', '3K', '4K', '2048x2048', '2304x1728', '1728x2304', '2848x1600', '1600x2848', '2496x1664', '1664x2496', '3136x1344', '3072x3072', '3456x2592', '2592x3456', '4096x2304', '2304x4096', '3744x2496', '2496x3744', '4704x2016', '4096x4096', '3520x4704', '4704x3520', '5504x3040', '3040x5504', '3328x4992', '4992x3328', '6240x2656'],
    },
    provider: 'jiekou',
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
  return getChatCapableModels().find((model) => model.id === 'deepseek/deepseek-ocr-2' && model.isEnabled)?.id
    ?? getChatCapableModels().find((model) => model.isDefault && model.isEnabled)?.id
    ?? getChatCapableModels().find((model) => model.isEnabled)?.id
    ?? fallbackAiModels[0].id
}

export function getDefaultAnalysisModelId() {
  return getAiModels('image_analysis').find((model) => model.id === 'deepseek/deepseek-ocr-2' && model.isEnabled)?.id
    ?? getAiModels('image_analysis').find((model) => model.isDefault && model.isEnabled)?.id
    ?? getAiModels('image_analysis').find((model) => model.isEnabled)?.id
    ?? fallbackAiModels[0].id
}

export function getDefaultPromptOptimizerModelId() {
  return getPromptOptimizerModels().find((model) => model.id === 'deepseek/deepseek-v3.1' && model.isEnabled)?.id
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
  return getAiModels('text').filter((model) => model.capabilities.includes('image_analysis'))
}

function getPromptOptimizerModels() {
  return getAiModels('text')
}
