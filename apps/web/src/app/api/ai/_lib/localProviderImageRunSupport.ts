import { getProviderDisplayLabel } from './providerApiConfig'
import {
  gptImage2SupportedSizeMap,
  nanoBananaAspectRatios,
  nanoBananaImageSizes,
  normalizeImageGenerationModelId,
  seedreamSizeValues,
} from '@/features/ai/aiImageModelCatalog'

export const defaultGeneratedMime = 'image/png'
export const maxImageReferenceInputs = 8
export const pollIntervalMs = 1400
export const pollTimeoutMs = 240000
export const nanoBanana2ModelId = 'nano-banana-2'
export const geekAiNanoBanana2ModelId = 'gemini-3.1-flash-image-preview'

export type ProviderImageResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
      image?: { url?: string }
    }
  }>
  created?: number
  data?: Array<{
    b64_json?: string
    image_base64?: string
    image_url?: string
    base64?: string
    revised_prompt?: string
    url?: string
  }>
  error?: { message?: string }
  image_urls?: string[]
  images?: Array<string | { b64_json?: string; image_base64?: string; image_url?: string; base64?: string; url?: string }>
  message?: string
  model?: string
  task_id?: string
  task_status?: 'failed' | 'pending' | 'running' | 'succeed'
}

export type ProviderClientConfig = {
  apiKey: string
  baseUrl: string
  provider: string
}

export type ImageModelFamily = 'doubao-seedream-5.0-lite' | 'gpt-image-2' | 'nano-banana-2'

export type ImageModelRunInput = {
  count: number
  gptQuality: string
  gptSize: string
  inputImages: string[]
  modelId: string
  provider: string
  nanoBananaAspectRatio: string
  nanoBananaImageSize: string
  prompt: string
  seedreamOutputFormat: string
  seedreamSize: string
}

export type ImageModelExecutorInput = ImageModelRunInput & { clientConfig: ProviderClientConfig }
export type ImageModelExecutor = (input: ImageModelExecutorInput) => Promise<string[]>

export function normalizeGptImageSize(size: string | undefined) {
  return size && gptImage2AllowedSizes.has(size) ? size : '1024x1024'
}

export function normalizeGptImageQuality(quality: string | undefined) {
  return quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'medium'
}

export function normalizeNanoBananaAspectRatio(aspectRatio: string | undefined) {
  return aspectRatio && nanoBananaAspectRatioSet.has(aspectRatio) ? aspectRatio : '1:1'
}

export function normalizeNanoBananaImageSize(imageSize: string | undefined) {
  return imageSize && nanoBananaImageSizeSet.has(imageSize) ? imageSize : '1K'
}

export function normalizeSeedreamSize(size: string | undefined) {
  return size && seedreamSizeSet.has(size) ? size : '2K'
}

export function normalizeSeedreamOutputFormat(outputFormat: string | undefined) {
  return outputFormat === 'jpeg' || outputFormat === 'jpg' ? 'jpeg' : 'png'
}

export function mapLegacyGptSize(aspectRatio: string | undefined) {
  return aspectRatio === '4:3' || aspectRatio === '16:9' || aspectRatio === '3:2' ? '1536x1024' : '1024x1024'
}

export function mapLegacyGptQuality(resolution: string | undefined) {
  return resolution === '2K' || resolution === '4K' ? 'high' : 'medium'
}

export function mapLegacyNanoBananaImageSize(resolution: string | undefined) {
  return resolution === '0.5K' || resolution === '2K' || resolution === '4K' ? resolution : '1K'
}

export function getImageModelFamily(modelId: string): ImageModelFamily {
  const normalized = normalizeImageGenerationModelId(modelId)
  if (normalized === 'nano-banana-2') return 'nano-banana-2'
  if (normalized === 'doubao-seedream-5.0-lite') return 'doubao-seedream-5.0-lite'
  return 'gpt-image-2'
}

export function createCostHint(provider: string, modelId: string, modelLabel: string, params: Record<string, unknown>) {
  const parts = [modelLabel]
  const family = getImageModelFamily(modelId)
  if (family === 'nano-banana-2') {
    parts.push(
      normalizeNanoBananaImageSize(getString(params.imageSize) ?? mapLegacyNanoBananaImageSize(getString(params.resolution))),
      normalizeNanoBananaAspectRatio(getString(params.aspectRatio))
    )
  } else if (family === 'doubao-seedream-5.0-lite') {
    parts.push(normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size)))
  } else {
    parts.push(
      normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio))),
      normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution)))
    )
  }
  return `${getProviderDisplayLabel(provider)} · ${parts.join(' · ')}`
}

export function buildJiekouImagePath(endpoint: string) {
  return `/${endpoint.replace(/^\/+/, '')}`
}

export function toJiekouNanoBananaSize(aspectRatio: string) {
  return normalizeNanoBananaAspectRatio(aspectRatio)
}

export function toJiekouNanoBananaImageSize(imageSize: string) {
  return imageSize === '0.5K' || imageSize === '2K' || imageSize === '4K' ? imageSize : '1K'
}

export function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(4, Math.round(value)))
}

export function createRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_local_${globalThis.crypto.randomUUID()}`
  return `run_local_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

const gptImage2AllowedSizes = new Set(
  Object.values(gptImage2SupportedSizeMap)
    .flatMap((sizeMap) => Object.values(sizeMap))
    .filter((value): value is string => typeof value === 'string')
)
const nanoBananaAspectRatioSet = new Set<string>([...nanoBananaAspectRatios])
const nanoBananaImageSizeSet = new Set<string>([...nanoBananaImageSizes])
const seedreamSizeSet = new Set<string>([...seedreamSizeValues])
