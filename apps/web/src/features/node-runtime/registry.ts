import type { JsonObject, NodeCardField, NodeCategory, NodeDefinition, NodePortDirection, NodeRuntimeSummary, NodeType, ResolvedNodePort } from '@/types/nodeRuntime'
import { getAnalysisModelSelectOptions, getDefaultAnalysisModelId, getDefaultChatModelId, getDefaultImageModelId, getImageModelSelectOptions } from '@/features/ai/mockAiContracts'

const gptImage2SizeOptions = [
  { label: '1024 x 1024', value: '1024x1024' },
  { label: '1024 x 1536', value: '1024x1536' },
  { label: '1536 x 1024', value: '1536x1024' },
]

const gptImage2QualityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
]

const nanoBananaAspectRatioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '2:3', value: '2:3' },
  { label: '3:2', value: '3:2' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '4:5', value: '4:5' },
  { label: '5:4', value: '5:4' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '21:9', value: '21:9' },
  { label: '9:21', value: '9:21' },
  { label: '1:4', value: '1:4' },
  { label: '4:1', value: '4:1' },
  { label: '1:8', value: '1:8' },
  { label: '8:1', value: '8:1' },
]

const nanoBananaImageSizeOptions = [
  { label: '0.5K', value: '0.5K' },
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
]

const seedreamSizeOptions = [
  { label: '2K auto', value: '2K' },
  { label: '3K auto', value: '3K' },
  { label: '4K auto', value: '4K' },
  { label: '2K 1:1 · 2048 x 2048', value: '2048x2048' },
  { label: '2K 4:3 · 2304 x 1728', value: '2304x1728' },
  { label: '2K 3:4 · 1728 x 2304', value: '1728x2304' },
  { label: '2K 16:9 · 2848 x 1600', value: '2848x1600' },
  { label: '2K 9:16 · 1600 x 2848', value: '1600x2848' },
  { label: '2K 3:2 · 2496 x 1664', value: '2496x1664' },
  { label: '2K 2:3 · 1664 x 2496', value: '1664x2496' },
  { label: '2K 21:9 · 3136 x 1344', value: '3136x1344' },
  { label: '3K 1:1 · 3072 x 3072', value: '3072x3072' },
  { label: '3K 4:3 · 3456 x 2592', value: '3456x2592' },
  { label: '3K 3:4 · 2592 x 3456', value: '2592x3456' },
  { label: '3K 16:9 · 4096 x 2304', value: '4096x2304' },
  { label: '3K 9:16 · 2304 x 4096', value: '2304x4096' },
  { label: '3K 3:2 · 3744 x 2496', value: '3744x2496' },
  { label: '3K 2:3 · 2496 x 3744', value: '2496x3744' },
  { label: '3K 21:9 · 4704 x 2016', value: '4704x2016' },
  { label: '4K 1:1 · 4096 x 4096', value: '4096x4096' },
  { label: '4K 4:3 · 3520 x 4704', value: '3520x4704' },
  { label: '4K 3:4 · 4704 x 3520', value: '4704x3520' },
  { label: '4K 16:9 · 5504 x 3040', value: '5504x3040' },
  { label: '4K 9:16 · 3040 x 5504', value: '3040x5504' },
  { label: '4K 3:2 · 3328 x 4992', value: '3328x4992' },
  { label: '4K 2:3 · 4992 x 3328', value: '4992x3328' },
  { label: '4K 21:9 · 6240 x 2656', value: '6240x2656' },
]

const seedreamOutputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
]

const jimengSizeOptions = [
  { label: '1K 1:1 · 1024 x 1024', value: '1024x1024' },
  { label: '2K 1:1 · 2048 x 2048', value: '2048x2048' },
  { label: '2K 4:3 · 2304 x 1728', value: '2304x1728' },
  { label: '2K 16:9 · 2560 x 1440', value: '2560x1440' },
  { label: '2K 3:2 · 2496 x 1664', value: '2496x1664' },
  { label: '2K 21:9 · 3024 x 1296', value: '3024x1296' },
  { label: '4K 1:1 · 4096 x 4096', value: '4096x4096' },
  { label: '4K 4:3 · 4694 x 3520', value: '4694x3520' },
  { label: '4K 3:2 · 4992 x 3328', value: '4992x3328' },
  { label: '4K 16:9 · 5404 x 3040', value: '5404x3040' },
  { label: '4K 21:9 · 6198 x 2656', value: '6198x2656' },
]

const jimengStrengthOptions = [
  { label: '0.3', value: '0.3' },
  { label: '0.5', value: '0.5' },
  { label: '0.7', value: '0.7' },
  { label: '0.9', value: '0.9' },
]

export const defaultAnalysisPrompt = 'Analyze this image in detail. Describe the scene, subjects, materials, lighting, composition, and notable visual traits. Then write one clean image prompt.'
const legacyAnalysisPrompt = '分析这张图片内容，尽可能描述场景中的物体和特征，并输出一段提示词。'

const imageModelField = {
  label: 'Model',
  name: 'modelId',
  options: getImageModelSelectOptions(),
  type: 'select' as const,
}

const analysisModelField = {
  label: 'Model',
  name: 'modelId',
  options: getAnalysisModelSelectOptions(),
  type: 'select' as const,
}

const gptImage2Fields = [
  imageModelField,
  { label: 'Size', name: 'size', options: gptImage2SizeOptions, type: 'select' as const },
  { label: 'Quality', name: 'quality', options: gptImage2QualityOptions, type: 'select' as const },
]

const nanoBananaImageFields = [
  imageModelField,
  { label: 'Aspect ratio', name: 'aspectRatio', options: nanoBananaAspectRatioOptions, type: 'select' as const },
  { label: 'Image size', name: 'imageSize', options: nanoBananaImageSizeOptions, type: 'select' as const },
]

const seedreamImageFields = [
  imageModelField,
  { label: 'Size', name: 'seedreamSize', options: seedreamSizeOptions, type: 'select' as const },
  { label: 'Format', name: 'seedreamOutputFormat', options: seedreamOutputFormatOptions, type: 'select' as const },
]

const jimengImageFields = [
  imageModelField,
  { label: 'Size', name: 'jimengSize', options: jimengSizeOptions, type: 'select' as const },
  { label: 'Strength', name: 'jimengStrength', options: jimengStrengthOptions, type: 'select' as const },
]

export const maxImageInputPorts = 6
export const maxChatInputPorts = 6
export const maxTextInputPorts = 6

const nodeCategoryOrder: NodeCategory[] = ['text', 'image', 'transform', 'utility']

const nodeCategoryLabels: Record<NodeCategory, string> = { image: 'Image', text: 'Text', transform: 'Transform', utility: 'Utility' }

export const nodeDefinitions: Record<NodeType, NodeDefinition> = {
  analysis: {
    accentColor: '#16a34a',
    aiDescription: 'Analyze image inputs and produce text that can be used as a prompt or description.',
    aiName: 'Image Analysis',
    aiUseCases: ['describe an image', 'extract a prompt from an image', 'analyze visual references'],
    category: 'text',
    defaultData: {
      analysisPrompt: defaultAnalysisPrompt,
      modelId: getDefaultAnalysisModelId(),
    },
    defaultCardSize: { height: 340, width: 330 },
    displayName: 'Analysis',
    cardFields: [analysisModelField],
    outputSummary: 'Text prompt from image analysis',
    paletteOrder: 50,
    paletteShortLabel: 'An',
    ports: [
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', required: true },
      { dataType: 'text', direction: 'in', id: 'prompt_in', label: 'Prompt in' },
      { dataType: 'text', direction: 'out', id: 'text_out', label: 'Text out' },
    ],
    runnable: true,
    type: 'analysis',
    version: 1,
  },
  chat: {
    accentColor: '#7c3aed',
    aiDescription: 'Multi-turn AI chat node that can gather prompt/image context and export selected replies as text outputs.',
    aiName: 'AI Chat',
    aiUseCases: ['chat with image references', 'merge multiple prompts', 'export selected AI replies downstream'],
    category: 'text',
    defaultData: {
      chatDraft: '',
      chatMessages: [],
      exportedMessageIds: [],
      imageInputCount: 1,
      modelId: getDefaultChatModelId(),
      textInputCount: 1,
    },
    defaultCardSize: { height: 520, width: 360 },
    defaultRuntimeCostHint: 'Chat runtime adapter later',
    displayName: 'Chat',
    cardFields: [{ label: 'Message', name: 'chatDraft', type: 'textarea' }],
    outputSummary: 'Exported chat replies',
    paletteOrder: 15,
    paletteShortLabel: 'Ch',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Prompt in', multiple: true },
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', multiple: true },
    ],
    type: 'chat',
    version: 1,
  },
  image: {
    accentColor: '#f97316',
    aiDescription: 'Hold an image asset and pass image references to downstream nodes.',
    aiName: 'Image Asset',
    aiUseCases: ['store an uploaded image', 'reuse generated image output', 'provide an image reference'],
    category: 'image',
    defaultData: {
      title: 'Image',
    },
    defaultCardSize: { height: 240, width: 420 },
    displayName: 'Image',
    cardFields: [
      { label: 'Asset ID', name: 'assetId', type: 'text' },
      { label: 'Title', name: 'title', type: 'text' },
    ],
    outputSummary: 'Preview image asset',
    paletteOrder: 20,
    paletteShortLabel: 'Im',
    ports: [
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in' },
      { dataType: 'image', direction: 'out', id: 'image_out', label: 'Image out' },
    ],
    type: 'image',
    version: 1,
  },
  image_gen: {
    accentColor: '#2563eb',
    aiDescription: 'Generate or edit one image from text and optional image references.',
    aiName: 'Single Image Generation',
    aiUseCases: ['generate one image', 'edit an image with prompt', 'combine prompt and references'],
    category: 'image',
    defaultData: {
      aspectRatio: '1:1',
      imageSize: '1K',
      imageInputCount: 1,
      jimengSize: '2048x2048',
      jimengStrength: '0.5',
      modelId: getDefaultImageModelId(),
      quality: 'medium',
      seedreamOutputFormat: 'png',
      seedreamSize: '2K',
      size: '1024x1024',
      textInputCount: 1,
    },
    defaultCardSize: { height: 320, width: 330 },
    defaultRuntimeCostHint: 'Mock only · API body later',
    displayName: 'Image Gen',
    cardFields: gptImage2Fields,
    outputSummary: 'One generated image asset',
    paletteOrder: 30,
    paletteShortLabel: 'Gen',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in', required: true },
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', multiple: true },
      { dataType: 'image', direction: 'out', id: 'image_out', label: 'Image out' },
    ],
    runnable: true,
    type: 'image_gen',
    version: 1,
  },
  image_gen_4: {
    accentColor: '#2563eb',
    aiDescription: 'Generate four image candidates from text and optional image references.',
    aiName: 'Four Image Candidates',
    aiUseCases: ['generate four variations', 'explore image candidates', 'batch visual ideation'],
    category: 'image',
    defaultData: {
      aspectRatio: '1:1',
      imageSize: '1K',
      imageInputCount: 1,
      jimengSize: '2048x2048',
      jimengStrength: '0.5',
      modelId: getDefaultImageModelId(),
      quality: 'medium',
      seedreamOutputFormat: 'png',
      seedreamSize: '2K',
      size: '1024x1024',
      textInputCount: 1,
    },
    defaultCardSize: { height: 350, width: 330 },
    defaultRuntimeCostHint: 'Mock only · API body later',
    displayName: 'Image Gen 4',
    cardFields: gptImage2Fields,
    outputSummary: 'Four image assets from four calls',
    paletteOrder: 40,
    paletteShortLabel: '4x',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in', required: true },
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', multiple: true },
      { dataType: 'image', direction: 'out', id: 'image_out_1', label: 'Asset 1 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_2', label: 'Asset 2 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_3', label: 'Asset 3 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_4', label: 'Asset 4 out' },
    ],
    runnable: true,
    type: 'image_gen_4',
    version: 1,
  },
  prompt: {
    accentColor: '#8b5cf6',
    aiDescription: 'Hold and output text prompts for downstream AI nodes.',
    aiName: 'Prompt Text',
    aiUseCases: ['write a prompt', 'feed text into generation', 'provide instruction text'],
    category: 'text',
    defaultData: {
      prompt: '',
    },
    defaultCardSize: { height: 220, width: 300 },
    displayName: 'Prompt',
    cardFields: [{ label: 'Prompt', name: 'prompt', type: 'textarea' }],
    outputSummary: 'Text prompt',
    paletteOrder: 10,
    paletteShortLabel: 'Pr',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in' },
      { dataType: 'text', direction: 'out', id: 'text_out', label: 'Text out' },
    ],
    type: 'prompt',
    version: 1,
  },
  prompt_optimizer: {
    accentColor: '#2563eb',
    aiDescription: 'Optimize a connected image prompt into a richer generation prompt.',
    aiName: 'Prompt Optimizer',
    aiUseCases: ['expand short image prompts', 'improve generation details', 'prepare prompts for image models'],
    category: 'text',
    defaultData: {
      optimizedPrompt: '',
    },
    defaultCardSize: { height: 320, width: 420 },
    defaultRuntimeCostHint: 'Chat streaming optimizer',
    displayName: 'Prompt Optimizer',
    cardFields: [],
    outputSummary: 'Optimized image prompt',
    paletteOrder: 12,
    paletteShortLabel: 'Opt',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Prompt in', required: true },
      { dataType: 'text', direction: 'out', id: 'text_out', label: 'Optimized out' },
    ],
    runnable: true,
    type: 'prompt_optimizer',
    version: 1,
  },
}

export function getNodeDefinition(type: NodeType) {
  return nodeDefinitions[type]
}

export function getNodeCardFields(type: NodeType, data: JsonObject): NodeCardField[] {
  if (type === 'image_gen' || type === 'image_gen_4') {
    return getImageGenerationCardFields(data)
  }
  if (type === 'analysis') {
    return getAnalysisCardFields()
  }
  return nodeDefinitions[type].cardFields
}

export function getNormalizedNodeData(type: NodeType, data: JsonObject): JsonObject {
  if (type === 'image_gen' || type === 'image_gen_4') {
    return getNormalizedImageGenerationData(data)
  }
  if (type === 'analysis') {
    return getNormalizedAnalysisData(data)
  }
  return data
}

export function getNodeCreateOptions() {
  return Object.values(nodeDefinitions)
    .sort((a, b) => a.paletteOrder - b.paletteOrder)
    .map((definition) => ({
      accentColor: definition.accentColor,
      category: definition.category,
      categoryLabel: nodeCategoryLabels[definition.category],
      categoryOrder: nodeCategoryOrder.indexOf(definition.category),
      label: definition.displayName,
      shortLabel: definition.paletteShortLabel,
      type: definition.type,
    }))
}

export function getDefaultNodeCardSize(type: NodeType) {
  return nodeDefinitions[type].defaultCardSize
}

export function getAiNodeRegistryEntries() {
  return Object.values(nodeDefinitions).map((definition) => ({
    description: definition.aiDescription,
    inputPorts: definition.ports.filter((port) => port.direction === 'in').map((port) => ({
      dataType: port.dataType,
      id: port.id,
      label: port.label,
      multiple: Boolean(port.multiple),
      required: Boolean(port.required),
    })),
    name: definition.aiName,
    outputPorts: definition.ports.filter((port) => port.direction === 'out').map((port) => ({
      dataType: port.dataType,
      id: port.id,
      label: port.label,
    })),
    type: definition.type,
    useCases: definition.aiUseCases,
  }))
}

export function createDefaultNodeData(type: NodeType): JsonObject {
  return { ...nodeDefinitions[type].defaultData }
}

export function createDefaultRuntimeSummary(type: NodeType): NodeRuntimeSummary {
  const definition = getNodeDefinition(type)
  return {
    costHint: definition.defaultRuntimeCostHint ?? null,
    error: null,
    lastRunId: null,
    resultAssetIds: [],
    status: 'idle',
  }
}

export function getImageGenerationCardFields(data: JsonObject): NodeCardField[] {
  const normalized = getNormalizedImageGenerationData(data)
  if (normalized.modelId === 'nano-banana-2') return nanoBananaImageFields
  if (normalized.modelId === 'doubao-seedream-5.0-lite') return seedreamImageFields
  if (normalized.modelId === 'jimeng_t2i_v40') return jimengImageFields
  return gptImage2Fields
}

export function getAnalysisCardFields(): NodeCardField[] {
  return [analysisModelField]
}

export function getNormalizedAnalysisData(data: JsonObject): JsonObject {
  const modelId = getAllowedFieldValue(
    typeof data.modelId === 'string' && data.modelId.trim() ? data.modelId : getDefaultAnalysisModelId(),
    getAnalysisModelSelectOptions().map((option) => String(option.value)),
    getDefaultAnalysisModelId()
  )
  const analysisPrompt = typeof data.analysisPrompt === 'string' && data.analysisPrompt.trim() && data.analysisPrompt !== legacyAnalysisPrompt
    ? data.analysisPrompt
    : defaultAnalysisPrompt
  return {
    ...data,
    analysisPrompt,
    modelId,
  }
}

export function getNormalizedImageGenerationData(data: JsonObject): JsonObject {
  const modelId = normalizeImageGenerationModelId(
    typeof data.modelId === 'string' && data.modelId.trim()
      ? data.modelId
      : getDefaultImageModelId()
  )
  const size = getAllowedFieldValue(
    typeof data.size === 'string' && data.size.trim() ? data.size : mapLegacySize(data),
    gptImage2SizeOptions.map((option) => option.value),
    '1024x1024'
  )
  const quality = getAllowedFieldValue(
    typeof data.quality === 'string' && data.quality.trim() ? data.quality : mapLegacyQuality(data),
    gptImage2QualityOptions.map((option) => option.value),
    'medium'
  )
  const aspectRatio = getAllowedFieldValue(
    typeof data.aspectRatio === 'string' && data.aspectRatio.trim() && data.aspectRatio !== 'auto' ? data.aspectRatio : '1:1',
    nanoBananaAspectRatioOptions.map((option) => option.value),
    '1:1'
  )
  const imageSize = getAllowedFieldValue(
    typeof data.imageSize === 'string' && data.imageSize.trim() ? data.imageSize : mapLegacyImageSize(data),
    nanoBananaImageSizeOptions.map((option) => option.value),
    '1K'
  )
  const seedreamSize = getAllowedFieldValue(
    typeof data.seedreamSize === 'string' && data.seedreamSize.trim() ? data.seedreamSize : '2K',
    seedreamSizeOptions.map((option) => option.value),
    '2K'
  )
  const seedreamOutputFormat = getAllowedFieldValue(
    typeof data.seedreamOutputFormat === 'string' && data.seedreamOutputFormat.trim() ? data.seedreamOutputFormat : 'png',
    seedreamOutputFormatOptions.map((option) => option.value),
    'png'
  )
  const jimengSize = getAllowedFieldValue(
    typeof data.jimengSize === 'string' && data.jimengSize.trim() ? data.jimengSize : '2048x2048',
    jimengSizeOptions.map((option) => option.value),
    '2048x2048'
  )
  const jimengStrength = getAllowedFieldValue(
    typeof data.jimengStrength === 'string' && data.jimengStrength.trim() ? data.jimengStrength : '0.5',
    jimengStrengthOptions.map((option) => option.value),
    '0.5'
  )
  return {
    ...data,
    aspectRatio,
    imageSize,
    jimengSize,
    jimengStrength,
    modelId,
    quality,
    seedreamOutputFormat,
    seedreamSize,
    size,
  }
}

function normalizeImageGenerationModelId(modelId: string) {
  if (modelId === 'gemini-3.1-flash-image-preview') return 'nano-banana-2'
  const allowedModelIds = new Set(getImageModelSelectOptions().map((option) => String(option.value)))
  return allowedModelIds.has(modelId) ? modelId : getDefaultImageModelId()
}

export function getResolvedNodePorts(type: NodeType, data: JsonObject): ResolvedNodePort[] {
  const definition = nodeDefinitions[type]
  if (type === 'chat') {
    const textInputDefinition = definition.ports.find((port) => port.id === 'text_in')
    const imageInputDefinition = definition.ports.find((port) => port.id === 'image_in')
    const textInputCount = clampPortCount(Number(data.textInputCount ?? 1), maxChatInputPorts)
    const imageInputCount = clampPortCount(Number(data.imageInputCount ?? 1), maxChatInputPorts)
    const exportedIds = getExportedChatMessageIds(data)
    return [
      ...(textInputDefinition
        ? Array.from({ length: textInputCount }, (_, index) => ({
            ...textInputDefinition,
            id: `${textInputDefinition.id}_${index + 1}`,
            label: `${textInputDefinition.label} ${index + 1}`,
            multiple: false,
            anchorY: getChatInputAnchorY(index, 0),
          }))
        : []),
      ...(imageInputDefinition
        ? Array.from({ length: imageInputCount }, (_, index) => ({
            ...imageInputDefinition,
            id: `${imageInputDefinition.id}_${index + 1}`,
            label: `${imageInputDefinition.label} ${index + 1}`,
            multiple: false,
            anchorY: getChatInputAnchorY(index, textInputCount),
          }))
        : []),
      ...exportedIds.map((id, index) => ({
        dataType: 'text' as const,
        direction: 'out' as const,
        id: `text_out_${id}`,
        label: `Export ${index + 1}`,
        anchorY: getDistributedAnchorY(index, exportedIds.length),
      })),
    ]
  }

  if (type === 'image_gen' || type === 'image_gen_4') {
    const imageInputDefinition = definition.ports.find((port) => port.id === 'image_in')
    const textInputDefinition = definition.ports.find((port) => port.id === 'text_in')
    const imageOutputDefinitions = definition.ports.filter((port) => port.direction === 'out')
    const textInputCount = clampPortCount(Number(data.textInputCount ?? 1), maxTextInputPorts)
    const imageInputCount = clampPortCount(Number(data.imageInputCount ?? 1), maxImageInputPorts)
    const inputCount = textInputCount + imageInputCount

    return [
      ...(textInputDefinition
        ? Array.from({ length: textInputCount }, (_, index) => ({
            ...textInputDefinition,
            id: index === 0 ? textInputDefinition.id : `${textInputDefinition.id}_${index + 1}`,
            label: `${textInputDefinition.label} ${index + 1}`,
            multiple: false,
            anchorY: getCombinedInputAnchorY(index, inputCount),
          }))
        : []),
      ...(imageInputDefinition
        ? Array.from({ length: imageInputCount }, (_, index) => ({
            ...imageInputDefinition,
            id: `${imageInputDefinition.id}_${index + 1}`,
            label: `${imageInputDefinition.label} ${index + 1}`,
            multiple: false,
            anchorY: getCombinedInputAnchorY(textInputCount + index, inputCount),
          }))
        : []),
      ...imageOutputDefinitions.map((port, index) => ({
        ...port,
        anchorY: getImageOutputAnchorY(type, index),
      })),
    ]
  }

  if (type === 'analysis') {
    return definition.ports.map((port) => ({
      ...port,
      anchorY: port.id === 'image_in' ? 0.28 : port.id === 'prompt_in' ? 0.54 : 0.5,
    }))
  }

  return resolveStaticPorts(definition.ports)
}

export function getPortsByDirection(type: NodeType, data: JsonObject, direction: NodePortDirection) {
  return getResolvedNodePorts(type, data).filter((port) => port.direction === direction)
}

export function getPortColorName(dataType: 'image' | 'text') {
  return dataType === 'image' ? 'green' : 'yellow'
}

export function isNodeType(value: string): value is NodeType {
  return Object.prototype.hasOwnProperty.call(nodeDefinitions, value)
}

export function canRunNodeType(type: NodeType) {
  return Boolean(nodeDefinitions[type].runnable)
}

function resolveStaticPorts(ports: NodeDefinition['ports']): ResolvedNodePort[] {
  const inputs = ports.filter((port) => port.direction === 'in')
  const outputs = ports.filter((port) => port.direction === 'out')
  return [
    ...inputs.map((port, index) => ({ ...port, anchorY: getDistributedAnchorY(index, inputs.length) })),
    ...outputs.map((port, index) => ({ ...port, anchorY: getDistributedAnchorY(index, outputs.length) })),
  ]
}

function getDistributedAnchorY(index: number, count: number) {
  if (count <= 1) return 0.5
  return (index + 1) / (count + 1)
}

function getCombinedInputAnchorY(index: number, count: number) {
  return 0.18 + ((index + 1) / (count + 1)) * 0.62
}

function getImageOutputAnchorY(type: NodeType, index: number) {
  if (type === 'image_gen_4') return 0.32 + index * 0.12
  return 0.5
}

function getChatInputAnchorY(index: number, textInputCount: number) {
  return Math.min(0.78, 0.24 + (textInputCount + index) * 0.085)
}

function getExportedChatMessageIds(data: JsonObject) {
  return Array.isArray(data.exportedMessageIds)
    ? data.exportedMessageIds.filter((value): value is string => typeof value === 'string').slice(0, 8)
    : []
}

function clampPortCount(value: number, max = maxImageInputPorts) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.round(value), max))
}

function mapLegacySize(data: JsonObject) {
  const legacyAspectRatio = typeof data.aspectRatio === 'string' ? data.aspectRatio : 'auto'
  if (legacyAspectRatio === '4:3' || legacyAspectRatio === '16:9' || legacyAspectRatio === '3:2') return '1536x1024'
  return '1024x1024'
}

function mapLegacyQuality(data: JsonObject) {
  const legacyResolution = typeof data.resolution === 'string' ? data.resolution : '1K'
  if (legacyResolution === '0.5K') return 'low'
  if (legacyResolution === '2K' || legacyResolution === '4K') return 'high'
  return 'medium'
}

function mapLegacyImageSize(data: JsonObject) {
  const legacyResolution = typeof data.resolution === 'string' ? data.resolution : '1K'
  if (legacyResolution === '2K' || legacyResolution === '4K') return legacyResolution
  return '1K'
}

function getAllowedFieldValue<T extends string | number>(value: T, allowedValues: T[], fallback: T) {
  return allowedValues.includes(value) ? value : fallback
}
