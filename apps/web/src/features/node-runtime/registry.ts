import type {
  JsonObject,
  NodeDefinition,
  NodePortDirection,
  NodeRuntimeSummary,
  NodeType,
  ResolvedNodePort,
} from '@/types/nodeRuntime'
import { getDefaultImageModelId, getImageModelSelectOptions } from '@/features/ai/mockAiContracts'

const aspectRatioOptions = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '3:2', value: '3:2' },
]

const resolutionOptions = [
  { label: '0.5K', value: '0.5K' },
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
]

const imageGenFields = [
  { label: 'Model', name: 'modelId', options: getImageModelSelectOptions(), type: 'select' as const },
  { label: 'Aspect ratio', name: 'aspectRatio', options: aspectRatioOptions, type: 'select' as const },
  { label: 'Resolution', name: 'resolution', options: resolutionOptions, type: 'select' as const },
]

export const maxImageInputPorts = 6

export const nodeDefinitions: Record<NodeType, NodeDefinition> = {
  analysis: {
    defaultData: {
      analysisPrompt: '分析这张图片内容，尽可能描述场景中的物体和特征，并输出一段提示词。',
    },
    displayName: 'Analysis',
    inspectorFields: [{ label: 'Analysis Prompt', name: 'analysisPrompt', type: 'textarea' }],
    outputSummary: 'Text prompt from image analysis',
    ports: [
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', required: true },
      { dataType: 'text', direction: 'in', id: 'prompt_in', label: 'Prompt in' },
      { dataType: 'text', direction: 'out', id: 'text_out', label: 'Text out' },
    ],
    type: 'analysis',
    version: 1,
  },
  image: {
    defaultData: {
      title: 'Image',
    },
    displayName: 'Image',
    inspectorFields: [
      { label: 'Asset ID', name: 'assetId', type: 'text' },
      { label: 'Title', name: 'title', type: 'text' },
    ],
    outputSummary: 'Preview image asset',
    ports: [
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in' },
      { dataType: 'image', direction: 'out', id: 'image_out', label: 'Image out' },
    ],
    type: 'image',
    version: 1,
  },
  image_gen: {
    defaultData: {
      aspectRatio: 'auto',
      imageInputCount: 1,
      modelId: getDefaultImageModelId(),
      resolution: '1K',
    },
    displayName: 'Image Gen',
    inspectorFields: imageGenFields,
    outputSummary: 'One generated image asset',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in', required: true },
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', multiple: true },
      { dataType: 'image', direction: 'out', id: 'image_out', label: 'Image out' },
    ],
    type: 'image_gen',
    version: 1,
  },
  image_gen_4: {
    defaultData: {
      aspectRatio: 'auto',
      imageInputCount: 1,
      modelId: getDefaultImageModelId(),
      resolution: '1K',
    },
    displayName: 'Image Gen 4',
    inspectorFields: imageGenFields,
    outputSummary: 'Four image assets from four calls',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in', required: true },
      { dataType: 'image', direction: 'in', id: 'image_in', label: 'Image in', multiple: true },
      { dataType: 'image', direction: 'out', id: 'image_out_1', label: 'Asset 1 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_2', label: 'Asset 2 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_3', label: 'Asset 3 out' },
      { dataType: 'image', direction: 'out', id: 'image_out_4', label: 'Asset 4 out' },
    ],
    type: 'image_gen_4',
    version: 1,
  },
  prompt: {
    defaultData: {
      prompt: 'DRAW a cat',
    },
    displayName: 'Prompt',
    inspectorFields: [{ label: 'Prompt', name: 'prompt', type: 'textarea' }],
    outputSummary: 'Text prompt',
    ports: [
      { dataType: 'text', direction: 'in', id: 'text_in', label: 'Text in' },
      { dataType: 'text', direction: 'out', id: 'text_out', label: 'Text out' },
    ],
    type: 'prompt',
    version: 1,
  },
}

export function getNodeDefinition(type: NodeType) {
  return nodeDefinitions[type]
}

export function createDefaultNodeData(type: NodeType): JsonObject {
  return { ...nodeDefinitions[type].defaultData }
}

export function createDefaultRuntimeSummary(type: NodeType): NodeRuntimeSummary {
  return {
    costHint: type === 'image_gen' || type === 'image_gen_4' ? 'Mock only · API body later' : null,
    error: null,
    lastRunId: null,
    resultAssetIds: [],
    status: 'idle',
  }
}

export function getResolvedNodePorts(type: NodeType, data: JsonObject): ResolvedNodePort[] {
  const definition = nodeDefinitions[type]
  if (type === 'image_gen' || type === 'image_gen_4') {
    const imageInputDefinition = definition.ports.find((port) => port.id === 'image_in')
    const textInputDefinition = definition.ports.find((port) => port.id === 'text_in')
    const imageOutputDefinitions = definition.ports.filter((port) => port.direction === 'out')
    const imageInputCount = clampPortCount(Number(data.imageInputCount ?? 1))

    return [
      ...(textInputDefinition ? [{ ...textInputDefinition, anchorY: 0.2 }] : []),
      ...(imageInputDefinition
        ? Array.from({ length: imageInputCount }, (_, index) => ({
            ...imageInputDefinition,
            id: `${imageInputDefinition.id}_${index + 1}`,
            label: `${imageInputDefinition.label} ${index + 1}`,
            multiple: false,
            anchorY: getImageInputAnchorY(index),
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

  return definition.ports.map((port) => ({ ...port, anchorY: 0.5 }))
}

export function getPortsByDirection(type: NodeType, data: JsonObject, direction: NodePortDirection) {
  return getResolvedNodePorts(type, data).filter((port) => port.direction === direction)
}

export function getPortColorName(dataType: 'image' | 'text') {
  return dataType === 'image' ? 'green' : 'yellow'
}

export function isNodeType(value: string): value is NodeType {
  return value === 'prompt' || value === 'image_gen' || value === 'image_gen_4' || value === 'analysis' || value === 'image'
}

function getImageInputAnchorY(index: number) {
  return 0.42 + index * 0.09
}

function getImageOutputAnchorY(type: NodeType, index: number) {
  if (type === 'image_gen_4') return 0.32 + index * 0.12
  return 0.5
}

function clampPortCount(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.round(value), maxImageInputPorts))
}
