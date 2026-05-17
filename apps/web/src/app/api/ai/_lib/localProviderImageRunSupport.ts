import { getProviderDisplayLabel } from './providerApiConfig'
import { normalizeImageGenerationModelId } from '@/features/ai/aiImageModelCatalog'

export const defaultGeneratedMime = 'image/png'
export const maxImageReferenceInputs = 8
export const pollIntervalMs = 1400
export const pollTimeoutMs = 240000
export const nanoBanana2ModelId = 'nano-banana-2'

export type ProviderImageResponse = {
  choices?: never
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
  const allowed = new Set(['1024x1024', '1024x1536', '1536x1024', '2048x2048', '2048x1152', '3840x2160', '2160x3840', '2048x1360', '1360x2048', '1152x2048', '2048x1536', '1536x2048', '2048x880', '880x2048', '688x2048', '2048x688', '2048x1024', '1024x2048'])
  return size && allowed.has(size) ? size : '1024x1024'
}

export function normalizeGptImageQuality(quality: string | undefined) {
  return quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'medium'
}

export function normalizeNanoBananaAspectRatio(aspectRatio: string | undefined) {
  const allowed = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '1:1'
}

export function normalizeNanoBananaImageSize(imageSize: string | undefined) {
  return imageSize === '1K' || imageSize === '2K' || imageSize === '4K' ? imageSize : '1K'
}

export function normalizeSeedreamSize(size: string | undefined) {
  const allowed = new Set(['2K', '3K', '4K', '2048x2048', '2304x1728', '1728x2304', '2848x1600', '1600x2848', '2496x1664', '1664x2496', '3136x1344', '3072x3072', '3456x2592', '2592x3456', '4096x2304', '2304x4096', '3744x2496', '2496x3744', '4704x2016', '4096x4096', '3520x4704', '4704x3520', '5504x3040', '3040x5504', '3328x4992', '4992x3328', '6240x2656'])
  return size && allowed.has(size) ? size : '2K'
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
  return resolution === '2K' || resolution === '4K' ? resolution : '1K'
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
  return { '1:1': '1x1', '2:3': '2x3', '3:2': '3x2', '3:4': '3x4', '4:3': '4x3', '4:5': '4x5', '5:4': '5x4', '9:16': '9x16', '16:9': '16x9', '21:9': '21x9' }[aspectRatio] ?? '1x1'
}

export function toJiekouNanoBananaQuality(imageSize: string) {
  return imageSize === '4K' ? '4k' : imageSize === '2K' ? '2k' : '1k'
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
