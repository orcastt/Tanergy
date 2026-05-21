import type { NodeCardField } from '@/types/nodeRuntime'
import { getDefaultImageModelId, getImageModelSelectOptions, normalizeAiModelId } from './aiModelCatalog'
import {
  gptImage2AspectRatios,
  gptImage2Resolutions,
  gptImage2SupportedSizeMap as gptImage2SupportedSizeMapContract,
  nanoBananaAspectRatios,
  nanoBananaImageSizes,
} from './aiImageModelContracts'

export const gptImage2SupportedSizeMap = gptImage2SupportedSizeMapContract

export const gptImage2AspectRatioOptions = toSimpleOptions(gptImage2AspectRatios)

export const gptImage2ResolutionOptions = toSimpleOptions(gptImage2Resolutions)

export const nanoBananaAspectRatioOptions = toSimpleOptions(nanoBananaAspectRatios)

export const nanoBananaImageSizeOptions = toSimpleOptions(nanoBananaImageSizes)

export const seedreamSizeOptions = [
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

const imageModelFamilySet = new Set([
  'doubao-seedream-5.0-lite',
  'gpt-image-2',
  'nano-banana-2',
])

const defaultImageModelField = {
  label: 'Model',
  name: 'modelId',
  options: getImageModelSelectOptions(),
  type: 'select' as const,
}

export function normalizeImageGenerationModelId(modelId: null | string | undefined) {
  const normalized = normalizeAiModelId(modelId)
  if (!normalized) return getDefaultImageModelId()
  if (imageModelFamilySet.has(normalized)) return normalized
  return getDefaultImageModelId()
}

export function getImageGenerationCardFields(
  input: { aspectRatio?: string; modelId: string },
  imageModelField = defaultImageModelField,
): NodeCardField[] {
  const normalizedModelId = normalizeImageGenerationModelId(input.modelId)
  if (normalizedModelId === 'nano-banana-2') {
    return [
      imageModelField,
      { label: 'Aspect ratio', name: 'aspectRatio', options: nanoBananaAspectRatioOptions, type: 'select' as const },
      { label: 'Image size', name: 'imageSize', options: nanoBananaImageSizeOptions, type: 'select' as const },
    ]
  }
  if (normalizedModelId === 'doubao-seedream-5.0-lite') {
    return [
      imageModelField,
      { label: 'Size', name: 'seedreamSize', options: seedreamSizeOptions, type: 'select' as const },
    ]
  }
  const aspectRatio = typeof input.aspectRatio === 'string' && input.aspectRatio.trim() ? input.aspectRatio : '1:1'
  return [
    imageModelField,
    { label: 'Aspect ratio', name: 'aspectRatio', options: gptImage2AspectRatioOptions, type: 'select' as const },
    { label: 'Quality', name: 'resolution', options: getGptImage2ResolutionOptions(aspectRatio), type: 'select' as const },
  ]
}

export function getGptImage2ResolutionOptions(aspectRatio: string) {
  const sizes = gptImage2SupportedSizeMap[aspectRatio] ?? gptImage2SupportedSizeMap['1:1']
  return gptImage2ResolutionOptions.filter((option) => Boolean(sizes[option.value]))
}

function toSimpleOptions(values: readonly string[]) {
  return values.map((value) => ({ label: value, value }))
}
