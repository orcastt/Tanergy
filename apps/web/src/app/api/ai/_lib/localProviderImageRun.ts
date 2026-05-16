import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../assets/_lib/assetStorageAdapter'
import { getImageDimensionsFromBytes, getImageExtensionFromMime } from '../../assets/_lib/imageByteMetadata'
import { fetchRemoteImageForAsset } from '../../assets/_lib/remoteImageImport'
import {
  assertAiInlineImageTotalByteLength,
  arrayBufferFromBuffer,
  normalizeAiInlineBase64DataUrl,
  parseAiInlineImageDataUrl,
  readJsonResponseWithLimit,
  toAiInlineImageDataUrl,
} from './aiInlineImageGuards'
import {
  getProviderApiKey,
  getProviderBaseUrl,
  getProviderDisplayLabel,
} from './providerApiConfig'
import { normalizeImageGenerationModelId } from '@/features/ai/aiImageModelCatalog'
import { getAiModelDefinition, asAiRunParams } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'

const defaultGeneratedMime = 'image/png'
const maxImageReferenceInputs = 8
const pollIntervalMs = 1400
const pollTimeoutMs = 240000
const nanoBanana2ModelId = 'nano-banana-2'

type ProviderImageResponse = {
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
  error?: {
    message?: string
  }
  images?: Array<string | {
    b64_json?: string
    image_base64?: string
    image_url?: string
    base64?: string
    url?: string
  }>
  message?: string
  model?: string
  task_id?: string
  task_status?: 'failed' | 'pending' | 'running' | 'succeed'
}

type ProviderClientConfig = {
  apiKey: string
  baseUrl: string
  provider: string
}

type ImageModelFamily = 'doubao-seedream-5.0-lite' | 'gpt-image-2' | 'nano-banana-2'

type ImageModelRunInput = {
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

type ImageModelExecutorInput = ImageModelRunInput & {
  clientConfig: ProviderClientConfig
}

type ImageModelExecutor = (input: ImageModelExecutorInput) => Promise<string[]>

const defaultImageModelExecutors: Record<ImageModelFamily, ImageModelExecutor> = {
  'doubao-seedream-5.0-lite': (input) => runDoubaoSeedreamLite({
    clientConfig: input.clientConfig,
    count: input.count,
    inputImages: input.inputImages,
    outputFormat: input.seedreamOutputFormat,
    prompt: input.prompt,
    size: input.seedreamSize,
  }),
  'gpt-image-2': (input) => runGptImage2({
    clientConfig: input.clientConfig,
    count: input.count,
    inputImages: input.inputImages,
    prompt: input.prompt,
    quality: input.gptQuality,
    size: input.gptSize,
  }),
  'nano-banana-2': (input) => runNanoBanana2({
    aspectRatio: input.nanoBananaAspectRatio,
    clientConfig: input.clientConfig,
    count: input.count,
    imageSize: input.nanoBananaImageSize,
    inputImages: input.inputImages,
    prompt: input.prompt,
  }),
}

const providerImageModelExecutors: Partial<Record<string, Partial<Record<ImageModelFamily, ImageModelExecutor>>>> = {
  jiekou: {
    'doubao-seedream-5.0-lite': (input) => runJiekouSeedreamLite({
      clientConfig: input.clientConfig,
      count: input.count,
      inputImages: input.inputImages,
      prompt: input.prompt,
      size: input.seedreamSize,
    }),
    'gpt-image-2': (input) => runJiekouGptImage2({
      clientConfig: input.clientConfig,
      count: input.count,
      inputImages: input.inputImages,
      prompt: input.prompt,
      quality: input.gptQuality,
      size: input.gptSize,
    }),
    'nano-banana-2': (input) => runJiekouNanoBanana2({
      aspectRatio: input.nanoBananaAspectRatio,
      clientConfig: input.clientConfig,
      count: input.count,
      imageSize: input.nanoBananaImageSize,
      inputImages: input.inputImages,
      prompt: input.prompt,
    }),
  },
}

export async function createLocalProviderImageRun(input: {
  context: ApiRequestContext
  charge: AiRunChargeSummary
  request: AiRunRequest
}) {
  const startedAt = Date.now()
  const prompt = input.request.prompt?.trim()
  if (!prompt) throw new Error('Missing image prompt.')

  const model = getAiModelDefinition(normalizeImageGenerationModelId(input.request.selectedModelId))
  const count = clampCount(Number(asAiRunParams(input.request.params).count ?? 1))
  const params = asAiRunParams(input.request.params)
  const gptSize = normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio)))
  const gptQuality = normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution)))
  const nanoBananaAspectRatio = normalizeNanoBananaAspectRatio(getString(params.aspectRatio))
  const nanoBananaImageSize = normalizeNanoBananaImageSize(getString(params.imageSize) ?? mapLegacyNanoBananaImageSize(getString(params.resolution)))
  const seedreamSize = normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size))
  const seedreamOutputFormat = normalizeSeedreamOutputFormat(getString(params.seedreamOutputFormat))
  const referenceImages = await resolveInputImages(input.request.inputAssetIds ?? [], input.context)

  const generatedSources = (await runSelectedImageModel({
    count,
    gptQuality,
    gptSize,
    inputImages: referenceImages,
    modelId: model.id,
    provider: model.provider,
    nanoBananaAspectRatio,
    nanoBananaImageSize,
    prompt,
    seedreamOutputFormat,
    seedreamSize,
  })).slice(0, count)

  if (generatedSources.length === 0) throw new Error('Image provider did not return any generated images.')

  const assets = await Promise.all(generatedSources.map((source, index) => persistGeneratedImage({
    context: input.context,
    index,
    prompt,
    source,
  })))

  return {
    boardId: input.request.boardId ?? null,
    charge: input.charge,
    chargedAccountId: input.charge.chargedAccountId,
    chargedScope: input.charge.chargedScope,
    costCredits: 0,
    costHint: createCostHint(model.provider, model.id, model.displayName, params),
    createdAt: new Date().toISOString(),
    entitlementSource: input.charge.entitlementSource,
    error: null,
    inputAssetIds: input.request.inputAssetIds ?? [],
    latencyMs: Math.max(1, Date.now() - startedAt),
    modelId: model.id,
    nodeId: input.request.nodeId ?? null,
    outputAssetIds: assets.map((asset) => asset.id),
    provider: model.provider,
    runId: createRunId(),
    runType: 'image_generation',
    status: 'succeeded',
    workspaceKind: input.charge.workspaceKind,
    workspaceSeatId: input.charge.workspaceSeatId ?? null,
  } satisfies AiRunRecord
}

export const createProviderImageRun = createLocalProviderImageRun

async function runSelectedImageModel(input: ImageModelRunInput) {
  const clientConfig = getProviderClientConfig(input.provider)
  const family = getImageModelFamily(input.modelId)
  const providerExecutors = providerImageModelExecutors[clientConfig.provider] ?? {}
  const executor = providerExecutors[family] ?? defaultImageModelExecutors[family]
  if (!executor) {
    throw new Error(`Unsupported local image model: ${input.modelId}`)
  }
  return executor({
    ...input,
    clientConfig,
  })
}

async function runNanoBanana2(input: {
  aspectRatio: string
  clientConfig: ProviderClientConfig
  count: number
  imageSize: string
  inputImages: string[]
  prompt: string
}) {
  const sharedBody = {
    aspect_ratio: input.aspectRatio,
    model: nanoBanana2ModelId,
    prompt: input.prompt,
    retries: 0,
    size: input.imageSize,
  }

  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    if (input.inputImages.length === 0) {
      outputs.push(...await runSingleImageGeneration(sharedBody, input.clientConfig))
      continue
    }
    const payload = await postProviderJson<ProviderImageResponse>('/images/edits', {
      ...sharedBody,
      image: input.inputImages.length === 1 ? input.inputImages[0] : input.inputImages,
    }, input.clientConfig)
    outputs.push(...extractImageSources(await settleImageTask(payload, input.clientConfig)))
  }
  return outputs
}

async function runJiekouNanoBanana2(input: {
  aspectRatio: string
  clientConfig: ProviderClientConfig
  count: number
  imageSize: string
  inputImages: string[]
  prompt: string
}) {
  const sharedBody = {
    prompt: input.prompt,
    quality: toJiekouNanoBananaQuality(input.imageSize),
    response_format: 'url',
    size: toJiekouNanoBananaSize(input.aspectRatio),
  }
  const endpoint = input.inputImages.length > 0 ? 'nano-banana-2-i2i' : 'nano-banana-2-t2i'
  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    const payload = await postProviderJson<ProviderImageResponse>(buildJiekouImagePath(endpoint), {
      ...sharedBody,
      ...(input.inputImages.length > 0 ? { image: input.inputImages.length === 1 ? input.inputImages[0] : input.inputImages } : {}),
    }, input.clientConfig)
    outputs.push(...extractImageSources(payload))
  }
  return outputs
}

async function runGptImage2(input: {
  clientConfig: ProviderClientConfig
  count: number
  inputImages: string[]
  prompt: string
  quality: string
  size: string
}) {
  const sharedBody = {
    background: 'auto',
    model: 'gpt-image-2',
    n: 1,
    output_format: 'png',
    prompt: input.prompt,
    quality: input.quality,
    response_format: 'url',
    retries: 0,
    size: input.size,
  }

  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    outputs.push(...await runSingleGptImage2(sharedBody, input.inputImages, input.clientConfig))
  }
  return outputs
}

async function runJiekouGptImage2(input: {
  clientConfig: ProviderClientConfig
  count: number
  inputImages: string[]
  prompt: string
  quality: string
  size: string
}) {
  const endpoint = input.inputImages.length > 0 ? 'gpt-image-2-edit' : 'gpt-image-2-text-to-image'
  const sharedBody = {
    background: 'auto',
    n: 1,
    output_format: 'png',
    prompt: input.prompt,
    quality: input.quality,
    size: input.size,
    ...(input.inputImages.length === 0 ? { moderation: 'auto' } : {}),
    ...(input.inputImages.length > 0 ? { image: input.inputImages.length === 1 ? input.inputImages[0] : input.inputImages } : {}),
  }

  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    const payload = await postProviderJson<ProviderImageResponse>(buildJiekouImagePath(endpoint), sharedBody, input.clientConfig)
    outputs.push(...extractImageSources(payload))
  }
  return outputs
}

async function runSingleGptImage2(sharedBody: Record<string, unknown>, inputImages: string[], clientConfig: ProviderClientConfig) {
  if (inputImages.length === 0) {
    const payload = await postProviderJson<ProviderImageResponse>('/images/generations', sharedBody, clientConfig)
    return extractImageSources(await settleImageTask(payload, clientConfig))
  }

  if (inputImages.length === 1) {
    const payload = await postProviderJson<ProviderImageResponse>('/images/edits', {
      ...sharedBody,
      image: inputImages[0],
    }, clientConfig)
    return extractImageSources(await settleImageTask(payload, clientConfig))
  }

  try {
    const payload = await postProviderJson<ProviderImageResponse>('/images/generations', {
      ...sharedBody,
      image: inputImages,
    }, clientConfig)
    return extractImageSources(await settleImageTask(payload, clientConfig))
  } catch {
    const payload = await postProviderJson<ProviderImageResponse>('/images/generations', {
      ...sharedBody,
      images: inputImages,
    } as Record<string, unknown>, clientConfig)
    return extractImageSources(await settleImageTask(payload, clientConfig))
  }
}

async function runDoubaoSeedreamLite(input: {
  clientConfig: ProviderClientConfig
  count: number
  inputImages: string[]
  outputFormat: string
  prompt: string
  size: string
}) {
  const sharedBody = {
    model: 'doubao-seedream-5.0-lite',
    output_format: input.outputFormat,
    prompt: input.prompt,
    retries: 0,
    size: input.size,
    watermark: false,
    ...createImageReferenceBody(input.inputImages),
  }
  if (input.count <= 1) return runSingleImageGeneration(sharedBody, input.clientConfig)

  try {
    const grouped = await runSingleImageGeneration({
      ...sharedBody,
      extra_body: {
        sequential_image_generation: 'auto',
        sequential_image_generation_options: {
          max_images: input.count,
        },
      },
    }, input.clientConfig)
    if (grouped.length >= input.count) return grouped.slice(0, input.count)
    return [
      ...grouped,
      ...await runRepeatedImageGenerations(sharedBody, input.count - grouped.length, input.clientConfig),
    ].slice(0, input.count)
  } catch {
    return runRepeatedImageGenerations(sharedBody, input.count, input.clientConfig)
  }
}

async function runJiekouSeedreamLite(input: {
  clientConfig: ProviderClientConfig
  count: number
  inputImages: string[]
  prompt: string
  size: string
}) {
  const sharedBody = {
    optimize_prompt_options: {
      mode: 'standard',
    },
    prompt: input.prompt,
    sequential_image_generation: 'disabled',
    size: input.size,
    watermark: false,
    ...(input.inputImages.length > 0 ? { image: input.inputImages } : {}),
  }
  if (input.count <= 1) {
    const payload = await postProviderJson<ProviderImageResponse>(buildJiekouImagePath('seedream-5.0-lite'), sharedBody, input.clientConfig)
    return extractImageSources(payload)
  }
  const payload = await postProviderJson<ProviderImageResponse>(buildJiekouImagePath('seedream-5.0-lite'), {
    ...sharedBody,
    sequential_image_generation: 'auto',
    sequential_image_generation_options: {
      max_images: input.count,
    },
  }, input.clientConfig)
  const outputs = extractImageSources(payload)
  if (outputs.length >= input.count) return outputs.slice(0, input.count)
  return [
    ...outputs,
    ...await runRepeatedJiekouImageGenerations('seedream-5.0-lite', sharedBody, input.count - outputs.length, input.clientConfig),
  ].slice(0, input.count)
}

async function runRepeatedImageGenerations(sharedBody: Record<string, unknown>, count: number, clientConfig: ProviderClientConfig) {
  const outputs: string[] = []
  for (let index = 0; index < count; index += 1) {
    outputs.push(...await runSingleImageGeneration(sharedBody, clientConfig))
  }
  return outputs
}

async function runRepeatedJiekouImageGenerations(
  endpoint: string,
  sharedBody: Record<string, unknown>,
  count: number,
  clientConfig: ProviderClientConfig,
) {
  const outputs: string[] = []
  for (let index = 0; index < count; index += 1) {
    const payload = await postProviderJson<ProviderImageResponse>(buildJiekouImagePath(endpoint), sharedBody, clientConfig)
    outputs.push(...extractImageSources(payload))
  }
  return outputs
}

async function runSingleImageGeneration(body: Record<string, unknown>, clientConfig: ProviderClientConfig) {
  const payload = await postProviderJson<ProviderImageResponse>('/images/generations', body, clientConfig)
  return extractImageSources(await settleImageTask(payload, clientConfig))
}

function createImageReferenceBody(inputImages: string[]) {
  if (inputImages.length === 0) return {}
  return {
    image: inputImages.length === 1 ? inputImages[0] : inputImages,
  }
}

async function persistGeneratedImage(input: {
  context: ApiRequestContext
  index: number
  prompt: string
  source: string
}) {
  if (input.source.startsWith('data:')) {
    const parsed = parseDataUrl(input.source)
    const dimensions = getImageDimensionsFromBytes(parsed.bytes, parsed.mime)
    return getAssetStorageAdapter().createFromUpload({
      bytes: parsed.bytes,
      fileName: `ai-${input.index + 1}.${getImageExtensionFromMime(parsed.mime)}`,
      height: dimensions?.height,
      mime: parsed.mime,
      origin: 'ai_run',
      title: createGeneratedAssetTitle(input.prompt, input.index),
      width: dimensions?.width,
    }, input.context)
  }

  const remote = await fetchRemoteImageForAsset(input.source)
  return getAssetStorageAdapter().createFromUpload({
    bytes: remote.bytes,
    fileName: remote.fileName,
    height: remote.height,
    mime: remote.mime,
    origin: 'ai_run',
    title: createGeneratedAssetTitle(input.prompt, input.index),
    width: remote.width,
  }, input.context)
}

async function resolveInputImages(
  assetIds: string[],
  context: ApiRequestContext
) {
  const uniqueIds = [...new Set(assetIds.filter(Boolean))]
  if (uniqueIds.length > maxImageReferenceInputs) {
    throw new Error(`Image generation accepts up to ${maxImageReferenceInputs} reference images.`)
  }
  const imageUrls: string[] = []
  let totalInlineBytes = 0
  for (const assetId of uniqueIds) {
    const record = await getAssetStorageAdapter().getRecord(assetId, context)
    const fileUrl = record.originalUrl
    const fileName = getAssetFileName(fileUrl)
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, context)
    totalInlineBytes += file.byteLength
    assertAiInlineImageTotalByteLength(totalInlineBytes, 'Reference images exceed the total allowed size for image generation.')
    imageUrls.push(toAiInlineImageDataUrl(mime, file))
  }
  return imageUrls
}

async function settleImageTask(payload: ProviderImageResponse, clientConfig: ProviderClientConfig) {
  if (payload.task_status === 'succeed') return payload
  if (payload.task_status === 'failed') {
    throw new Error(payload.error?.message ?? payload.message ?? 'Image generation failed.')
  }
  if (!payload.task_id) return payload

  const startedAt = Date.now()
  while (Date.now() - startedAt < pollTimeoutMs) {
    await wait(pollIntervalMs)
    const next = await getProviderJson<ProviderImageResponse>(`/images/${encodeURIComponent(payload.task_id)}`, clientConfig)
    if (next.task_status === 'succeed') return next
    if (next.task_status === 'failed') {
      throw new Error(next.error?.message ?? next.message ?? 'Image generation failed.')
    }
  }

  throw new Error('Image generation timed out.')
}

function extractImageSources(payload: ProviderImageResponse) {
  const items = payload.images ?? payload.data ?? []
  return items.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) {
      if (item.startsWith('data:')) return [item.trim()]
      if (item.startsWith('http://') || item.startsWith('https://')) return [item.trim()]
      return [normalizeAiInlineBase64DataUrl(item.trim(), defaultGeneratedMime)]
    }
    if (!item || typeof item !== 'object') return []
    if (typeof item.url === 'string' && item.url.trim()) return [item.url.trim()]
    if (typeof item.image_url === 'string' && item.image_url.trim()) return [item.image_url.trim()]
    const b64Image = item.b64_json ?? item.base64 ?? item.image_base64
    if (typeof b64Image === 'string' && b64Image.trim()) {
      return [normalizeAiInlineBase64DataUrl(b64Image, defaultGeneratedMime)]
    }
    return []
  })
}

async function postProviderJson<T extends { error?: { message?: string }; message?: string }>(path: string, body: Record<string, unknown>, clientConfig: ProviderClientConfig) {
  const response = await fetch(`${clientConfig.baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${clientConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const payload = await readJsonResponseWithLimit<T>(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'AI provider request failed.')
  }
  return payload
}

async function getProviderJson<T extends { error?: { message?: string }; message?: string }>(path: string, clientConfig: ProviderClientConfig) {
  const response = await fetch(`${clientConfig.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${clientConfig.apiKey}`,
    },
  })
  const payload = await readJsonResponseWithLimit<T>(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'AI provider request failed.')
  }
  return payload
}

function parseDataUrl(dataUrl: string) {
  const parsed = parseAiInlineImageDataUrl(dataUrl)
  return {
    bytes: arrayBufferFromBuffer(parsed.buffer),
    mime: parsed.mime,
  }
}

function createGeneratedAssetTitle(prompt: string, index: number) {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Generated image'
  return index === 0 ? cleanPrompt : `${cleanPrompt} ${index + 1}`
}

function createCostHint(provider: string, modelId: string, modelLabel: string, params: Record<string, unknown>) {
  const parts = [modelLabel]
  const family = getImageModelFamily(modelId)
  const size = normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio)))
  const quality = normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution)))
  const aspectRatio = normalizeNanoBananaAspectRatio(getString(params.aspectRatio))
  const imageSize = normalizeNanoBananaImageSize(getString(params.imageSize) ?? mapLegacyNanoBananaImageSize(getString(params.resolution)))
  const seedreamSize = normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size))

  if (family === 'nano-banana-2') {
    parts.push(imageSize, aspectRatio)
  } else if (family === 'doubao-seedream-5.0-lite') {
    parts.push(seedreamSize)
  } else {
    parts.push(size, quality)
  }
  return `${providerLabel(provider)} · ${parts.join(' · ')}`
}

function getAssetFileName(url: string) {
  const pathname = new URL(url, 'http://tangent.local').pathname
  const fileName = pathname.split('/').filter(Boolean).at(-1)
  if (!fileName) throw new Error('Asset file URL is missing a filename.')
  return fileName
}

function normalizeGptImageSize(size: string | undefined) {
  const allowed = new Set([
    '1024x1024',
    '1024x1536',
    '1536x1024',
    '2048x2048',
    '2048x1152',
    '3840x2160',
    '2160x3840',
    '2048x1360',
    '1360x2048',
    '1152x2048',
    '2048x1536',
    '1536x2048',
    '2048x880',
    '880x2048',
    '688x2048',
    '2048x688',
    '2048x1024',
    '1024x2048',
  ])
  if (size && allowed.has(size)) return size
  return '1024x1024'
}

function normalizeGptImageQuality(quality: string | undefined) {
  if (quality === 'low' || quality === 'medium' || quality === 'high') return quality
  return 'medium'
}

function normalizeNanoBananaAspectRatio(aspectRatio: string | undefined) {
  const allowed = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '1:1'
}

function normalizeNanoBananaImageSize(imageSize: string | undefined) {
  if (imageSize === '1K' || imageSize === '2K' || imageSize === '4K') return imageSize
  return '1K'
}

function normalizeSeedreamSize(size: string | undefined) {
  const allowed = new Set([
    '2K',
    '3K',
    '4K',
    '2048x2048',
    '2304x1728',
    '1728x2304',
    '2848x1600',
    '1600x2848',
    '2496x1664',
    '1664x2496',
    '3136x1344',
    '3072x3072',
    '3456x2592',
    '2592x3456',
    '4096x2304',
    '2304x4096',
    '3744x2496',
    '2496x3744',
    '4704x2016',
    '4096x4096',
    '3520x4704',
    '4704x3520',
    '5504x3040',
    '3040x5504',
    '3328x4992',
    '4992x3328',
    '6240x2656',
  ])
  return size && allowed.has(size) ? size : '2K'
}

function normalizeSeedreamOutputFormat(outputFormat: string | undefined) {
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') return 'jpeg'
  return 'png'
}

function mapLegacyGptSize(aspectRatio: string | undefined) {
  if (aspectRatio === '4:3' || aspectRatio === '16:9' || aspectRatio === '3:2') return '1536x1024'
  return '1024x1024'
}

function mapLegacyGptQuality(resolution: string | undefined) {
  if (resolution === '2K' || resolution === '4K') return 'high'
  return 'medium'
}

function mapLegacyNanoBananaImageSize(resolution: string | undefined) {
  if (resolution === '2K' || resolution === '4K') return resolution
  return '1K'
}

function getImageModelFamily(modelId: string): ImageModelFamily {
  const normalized = normalizeImageGenerationModelId(modelId)
  if (normalized === 'nano-banana-2') return 'nano-banana-2'
  if (normalized === 'doubao-seedream-5.0-lite') return 'doubao-seedream-5.0-lite'
  return 'gpt-image-2'
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(4, Math.round(value)))
}

function createRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_local_${globalThis.crypto.randomUUID()}`
  return `run_local_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getProviderClientConfig(provider: string): ProviderClientConfig {
  return {
    apiKey: getProviderApiKey(provider, 'image'),
    baseUrl: getProviderBaseUrl(provider, 'image'),
    provider,
  }
}

function buildJiekouImagePath(endpoint: string) {
  return `/${endpoint.replace(/^\/+/, '')}`
}

function toJiekouNanoBananaSize(aspectRatio: string) {
  return {
    '1:1': '1x1',
    '2:3': '2x3',
    '3:2': '3x2',
    '3:4': '3x4',
    '4:3': '4x3',
    '4:5': '4x5',
    '5:4': '5x4',
    '9:16': '9x16',
    '16:9': '16x9',
    '21:9': '21x9',
  }[aspectRatio] ?? '1x1'
}

function toJiekouNanoBananaQuality(imageSize: string) {
  return imageSize === '4K' ? '4k' : imageSize === '2K' ? '2k' : '1k'
}

function providerLabel(provider: string) {
  return getProviderDisplayLabel(provider)
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}
