import type { JsonObject } from '@/types/nodeRuntime'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import type { AiRunRequest } from './aiTypes'
import {
  getGptImage2ResolutionOptions,
  gptImage2AspectRatioOptions,
  gptImage2SupportedSizeMap,
  nanoBananaAspectRatioOptions,
  nanoBananaImageSizeOptions,
  normalizeImageGenerationModelId,
  seedreamSizeOptions,
} from './aiImageModelOptions'

export function getNormalizedImageGenerationData(data: JsonObject) {
  const modelId = normalizeImageGenerationModelId(typeof data.modelId === 'string' && data.modelId.trim() ? data.modelId : null)
  const gptAspectRatio = getAllowedFieldValue(
    getRequestedGptImage2AspectRatio(data),
    gptImage2AspectRatioOptions.map((option) => option.value),
    '1:1',
  )
  const resolutionOptions = getGptImage2ResolutionOptions(gptAspectRatio)
  const resolution = getAllowedFieldValue(
    getRequestedGptImage2Resolution(data),
    resolutionOptions.map((option) => option.value),
    resolutionOptions[0]?.value ?? '1K',
  )
  const size = getGptImage2Size(gptAspectRatio, resolution)
  const quality = getGptImage2Quality(resolution)
  const aspectRatio = getAllowedFieldValue(
    typeof data.aspectRatio === 'string' && data.aspectRatio.trim() && data.aspectRatio !== 'auto'
      ? data.aspectRatio
      : modelId === 'nano-banana-2'
        ? '1:1'
        : gptAspectRatio,
    (modelId === 'nano-banana-2' ? nanoBananaAspectRatioOptions : gptImage2AspectRatioOptions).map((option) => option.value),
    '1:1',
  )
  const imageSize = getAllowedFieldValue(
    typeof data.imageSize === 'string' && data.imageSize.trim() ? data.imageSize : mapLegacyImageSize(data),
    nanoBananaImageSizeOptions.map((option) => option.value),
    '1K',
  )
  const seedreamSize = getAllowedFieldValue(
    typeof data.seedreamSize === 'string' && data.seedreamSize.trim() ? data.seedreamSize : '2K',
    seedreamSizeOptions.map((option) => option.value),
    '2K',
  )
  return {
    ...data,
    aspectRatio,
    imageSize,
    modelId,
    quality,
    resolution,
    seedreamSize,
    size,
  }
}

export function createImageGenerationParams(data: JsonObject, nodeType: 'image_gen' | 'image_gen_4'): JsonObject {
  const normalized = getNormalizedImageGenerationData(data)
  const count = nodeType === 'image_gen_4' ? 4 : 1
  if (normalized.modelId === 'nano-banana-2') {
    return { count, aspectRatio: String(normalized.aspectRatio ?? '1:1'), imageSize: String(normalized.imageSize ?? '1K') }
  }
  if (normalized.modelId === 'doubao-seedream-5.0-lite') {
    return { count, seedreamSize: String(normalized.seedreamSize ?? '2K') }
  }
  return {
    aspectRatio: String(normalized.aspectRatio ?? '1:1'),
    count,
    quality: String(normalized.quality ?? 'medium'),
    resolution: String(normalized.resolution ?? '1K'),
    size: String(normalized.size ?? '1024x1024'),
  }
}

export function getEstimatedImageGenerationDurationMs(data: JsonObject, nodeType: 'image_gen' | 'image_gen_4') {
  const normalized = getNormalizedImageGenerationData(data)
  const count = nodeType === 'image_gen_4' ? 4 : 1
  if (normalized.modelId === 'nano-banana-2') {
    const imageSize = String(normalized.imageSize ?? '1K')
    const baseMs = imageSize === '0.5K' ? 32_000 : imageSize === '2K' ? 58_000 : imageSize === '4K' ? 84_000 : 42_000
    return Math.round(baseMs * (1 + (count - 1) * 0.5))
  }
  if (normalized.modelId === 'doubao-seedream-5.0-lite') {
    const size = String(normalized.seedreamSize ?? '2K')
    const baseMs = size.startsWith('4K') || size.includes('4096') || size.includes('5504') || size.includes('6240')
      ? 96_000
      : size.startsWith('3K') || size.includes('3072') || size.includes('3456') || size.includes('4704')
        ? 78_000
        : 58_000
    return Math.round(baseMs * (count > 1 ? 1.45 : 1))
  }
  const quality = String(normalized.quality ?? 'medium')
  const size = String(normalized.size ?? '1024x1024')
  const resolution = String(normalized.resolution ?? '')
  const baseMs = quality === 'low' ? 42_000 : quality === 'high' ? 82_000 : 58_000
  const sizeMultiplier = resolution === '4K' ? 1.45 : resolution === '2K' || size !== '1024x1024' ? 1.15 : 1
  return Math.round(baseMs * sizeMultiplier * (1 + (count - 1) * 0.55))
}

export function getGeneratedImageAspectWarning(request: AiRunRequest | null | undefined, generatedAssets: TangentAssetRecord[]) {
  if (!request || String(request.selectedModelId ?? '') !== 'nano-banana-2') return null
  const requestedAspectRatio = parseRatioStringAspectRatio(String(request.params?.aspectRatio ?? ''))
  if (!requestedAspectRatio) return null
  const mismatched = generatedAssets.find((asset) => {
    const actualAspectRatio = getAspectRatio(asset.width, asset.height)
    if (!actualAspectRatio) return false
    return Math.abs(actualAspectRatio - requestedAspectRatio) / requestedAspectRatio > 0.12
  })
  return mismatched ? `Returned image aspect differs from requested ${String(request.params?.aspectRatio ?? 'ratio')}.` : null
}

export function getImageGenerationPreviewAspectRatio(data: JsonObject) {
  const normalized = getNormalizedImageGenerationData(data)
  if (normalized.modelId === 'nano-banana-2') return parseRatioStringAspectRatio(normalized.aspectRatio)
  if (normalized.modelId === 'doubao-seedream-5.0-lite') return parseWidthHeightAspectRatio(normalized.seedreamSize)
  return parseWidthHeightAspectRatio(normalized.size)
}

export function getRequestedGptImage2AspectRatio(data: JsonObject) {
  if (typeof data.aspectRatio === 'string' && data.aspectRatio.trim() && data.aspectRatio !== 'auto') return data.aspectRatio
  return mapLegacyGptImage2AspectRatio(data)
}

export function getRequestedGptImage2Resolution(data: JsonObject) {
  if (typeof data.resolution === 'string' && data.resolution.trim()) return data.resolution
  return mapLegacyGptImage2Resolution(data)
}

export function getGptImage2Size(aspectRatio: string, resolution: string) {
  const aspectSizes = gptImage2SupportedSizeMap[aspectRatio] ?? gptImage2SupportedSizeMap['1:1']
  return aspectSizes[resolution] ?? gptImage2SupportedSizeMap['1:1']['1K'] ?? '1024x1024'
}

export function getGptImage2Quality(resolution: string) {
  return resolution === '2K' || resolution === '4K' ? 'high' : 'medium'
}

function getAllowedFieldValue<T extends string | number>(value: T, allowedValues: T[], fallback: T) {
  return allowedValues.includes(value) ? value : fallback
}

function mapLegacyImageSize(data: JsonObject) {
  const legacyResolution = typeof data.resolution === 'string' ? data.resolution : '1K'
  return legacyResolution === '0.5K' || legacyResolution === '2K' || legacyResolution === '4K' ? legacyResolution : '1K'
}

function mapLegacyGptImage2AspectRatio(data: JsonObject) {
  const legacySize = typeof data.size === 'string' ? data.size.trim() : ''
  switch (legacySize) {
    case '1024x1536':
    case '1360x2048':
      return '2:3'
    case '1536x1024':
    case '2048x1360':
      return '3:2'
    case '1536x2048':
      return '3:4'
    case '2048x1536':
      return '4:3'
    case '1152x2048':
    case '2160x3840':
      return '9:16'
    case '2048x1152':
    case '3840x2160':
      return '16:9'
    case '2048x880':
      return '21:9'
    case '880x2048':
      return '9:21'
    case '2048x1024':
      return '2:1'
    case '1024x2048':
      return '1:2'
    case '2048x688':
      return '3:1'
    case '688x2048':
      return '1:3'
    default:
      return '1:1'
  }
}

function mapLegacyGptImage2Resolution(data: JsonObject) {
  const legacySize = typeof data.size === 'string' ? data.size.trim() : ''
  if (legacySize === '1024x1024' || legacySize === '1024x1536' || legacySize === '1536x1024') return '1K'
  if (legacySize === '3840x2160' || legacySize === '2160x3840') return '4K'
  if (legacySize) return '2K'
  const legacyQuality = typeof data.quality === 'string' ? data.quality.trim().toLowerCase() : ''
  if (legacyQuality === 'high') return '2K'
  return typeof data.resolution === 'string' && data.resolution.trim() ? data.resolution : '1K'
}

function parseWidthHeightAspectRatio(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  return getAspectRatio(Number(match[1]), Number(match[2]))
}

function parseRatioStringAspectRatio(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  return getAspectRatio(Number(match[1]), Number(match[2]))
}

function getAspectRatio(width: number | null | undefined, height: number | null | undefined) {
  if (typeof width !== 'number' || typeof height !== 'number') return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}
