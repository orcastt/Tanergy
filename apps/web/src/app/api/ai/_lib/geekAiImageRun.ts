import { Buffer } from 'node:buffer'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../assets/_lib/assetStorageAdapter'
import { getImageDimensionsFromBytes, getImageExtensionFromMime } from '../../assets/_lib/imageByteMetadata'
import { fetchRemoteImageForAsset } from '../../assets/_lib/remoteImageImport'
import { getAiModelDefinition, asAiRunParams } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'

const defaultGeekAiBaseUrl = 'https://geekai.co/api/v1'
const defaultGeneratedMime = 'image/png'
const pollIntervalMs = 1400
const pollTimeoutMs = 45000

type GeekAiImageResponse = {
  choices?: never
  created?: number
  data?: Array<{
    b64_json?: string
    revised_prompt?: string
    url?: string
  }>
  error?: {
    message?: string
  }
  message?: string
  model?: string
  task_id?: string
  task_status?: 'failed' | 'pending' | 'running' | 'succeed'
}

type GeekAiChatMessageContent = string | Array<{ text?: string; type?: string }>

type GeekAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: GeekAiChatMessageContent
      image?: string | { url?: string }
    }
  }>
  error?: {
    message?: string
  }
  message?: string
}

export async function createGeekAiImageRun(input: {
  context: ApiRequestContext
  charge: AiRunChargeSummary
  request: AiRunRequest
}) {
  const startedAt = Date.now()
  const prompt = input.request.prompt?.trim()
  if (!prompt) throw new Error('Missing image prompt.')

  const model = getAiModelDefinition(input.request.selectedModelId)
  const count = clampCount(Number(asAiRunParams(input.request.params).count ?? 1))
  const params = asAiRunParams(input.request.params)
  const gptSize = normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio)))
  const gptQuality = normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution)))
  const geminiAspectRatio = normalizeGeminiAspectRatio(getString(params.aspectRatio))
  const geminiImageSize = normalizeGeminiImageSize(getString(params.imageSize) ?? mapLegacyGeminiImageSize(getString(params.resolution)))
  const seedreamSize = normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size))
  const seedreamOutputFormat = normalizeSeedreamOutputFormat(getString(params.seedreamOutputFormat))
  const jimengSize = normalizeJimengSize(getString(params.jimengSize) ?? getString(params.size))
  const jimengStrength = normalizeJimengStrength(params.jimengStrength)
  const referenceImages = await resolveInputImages(input.request.inputAssetIds ?? [], input.context, {
    preferPreview: model.id === 'gemini-3.1-flash-image-preview',
  })

  const generatedSources = (await runSelectedImageModel({
    count,
    geminiAspectRatio,
    geminiImageSize,
    gptQuality,
    gptSize,
    inputImages: referenceImages,
    jimengSize,
    jimengStrength,
    modelId: model.id,
    prompt,
    seedreamOutputFormat,
    seedreamSize,
  })).slice(0, count)

  if (generatedSources.length === 0) throw new Error('GeekAI did not return any generated images.')

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
    costHint: createCostHint(model.id, model.displayName, params),
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

async function runSelectedImageModel(input: {
  count: number
  geminiAspectRatio: string
  geminiImageSize: string
  gptQuality: string
  gptSize: string
  inputImages: string[]
  jimengSize: string
  jimengStrength: string
  modelId: string
  prompt: string
  seedreamOutputFormat: string
  seedreamSize: string
}) {
  if (input.modelId === 'gemini-3.1-flash-image-preview') {
    return runGemini31FlashImagePreview({
      aspectRatio: input.geminiAspectRatio,
      count: input.count,
      imageSize: input.geminiImageSize,
      inputImages: input.inputImages,
      prompt: input.prompt,
    })
  }
  if (input.modelId === 'doubao-seedream-5.0-lite') {
    return runDoubaoSeedreamLite({
      count: input.count,
      inputImages: input.inputImages,
      outputFormat: input.seedreamOutputFormat,
      prompt: input.prompt,
      size: input.seedreamSize,
    })
  }
  if (input.modelId === 'jimeng_t2i_v40') {
    return runJimengImage40({
      count: input.count,
      inputImages: input.inputImages,
      prompt: input.prompt,
      size: input.jimengSize,
      strength: input.jimengStrength,
    })
  }
  return runGptImage2({
    count: input.count,
    inputImages: input.inputImages,
    prompt: input.prompt,
    quality: input.gptQuality,
    size: input.gptSize,
  })
}

async function runGptImage2(input: {
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
    outputs.push(...await runSingleGptImage2(sharedBody, input.inputImages))
  }
  return outputs
}

async function runSingleGptImage2(sharedBody: Record<string, unknown>, inputImages: string[]) {
  if (inputImages.length === 0) {
    const payload = await postGeekAiJson<GeekAiImageResponse>('/images/generations', sharedBody)
    return extractImageSources(await settleImageTask(payload))
  }

  if (inputImages.length === 1) {
    const payload = await postGeekAiJson<GeekAiImageResponse>('/images/edits', {
      ...sharedBody,
      image: inputImages[0],
    })
    return extractImageSources(await settleImageTask(payload))
  }

  try {
    const payload = await postGeekAiJson<GeekAiImageResponse>('/images/generations', {
      ...sharedBody,
      image: inputImages,
    })
    return extractImageSources(await settleImageTask(payload))
  } catch {
    const payload = await postGeekAiJson<GeekAiImageResponse>('/images/generations', {
      ...sharedBody,
      images: inputImages,
    } as Record<string, unknown>)
    return extractImageSources(await settleImageTask(payload))
  }
}

async function runGemini31FlashImagePreview(input: {
  aspectRatio: string
  count: number
  imageSize: string
  inputImages: string[]
  prompt: string
}) {
  const outputs: string[] = []
  for (let index = 0; index < input.count; index += 1) {
    const payload = await postGeekAiJson<GeekAiChatCompletionResponse>('/chat/completions', {
      background: false,
      image: {
        aspect_ratio: input.aspectRatio,
        image_size: input.imageSize,
      },
      messages: [
        {
          content: [
            { text: input.prompt, type: 'text' },
            ...input.inputImages.map((url) => ({
              image_url: { url: normalizeGeminiChatInputImage(url) },
              type: 'image_url',
            })),
          ],
          role: 'user',
        },
      ],
      model: 'gemini-3.1-flash-image-preview',
      stream: false,
    })
    const source = extractChatCompletionImageSource(payload)
    if (!source) throw new Error('GeekAI did not return a generated image.')
    outputs.push(source)
  }
  return outputs
}

async function runDoubaoSeedreamLite(input: {
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
  if (input.count <= 1) return runSingleImageGeneration(sharedBody)

  try {
    const grouped = await runSingleImageGeneration({
      ...sharedBody,
      extra_body: {
        sequential_image_generation: 'auto',
        sequential_image_generation_options: {
          max_images: input.count,
        },
      },
    })
    if (grouped.length >= input.count) return grouped.slice(0, input.count)
    return [
      ...grouped,
      ...await runRepeatedImageGenerations(sharedBody, input.count - grouped.length),
    ].slice(0, input.count)
  } catch {
    return runRepeatedImageGenerations(sharedBody, input.count)
  }
}

async function runJimengImage40(input: {
  count: number
  inputImages: string[]
  prompt: string
  size: string
  strength: string
}) {
  const sharedBody = {
    model: 'jimeng_t2i_v40',
    prompt: input.prompt,
    retries: 0,
    size: input.size,
    ...(input.inputImages.length > 0 ? { strength: Number(input.strength) } : {}),
    ...createImageReferenceBody(input.inputImages),
  }
  return runRepeatedImageGenerations(sharedBody, input.count)
}

async function runRepeatedImageGenerations(sharedBody: Record<string, unknown>, count: number) {
  const outputs: string[] = []
  for (let index = 0; index < count; index += 1) {
    outputs.push(...await runSingleImageGeneration(sharedBody))
  }
  return outputs
}

async function runSingleImageGeneration(body: Record<string, unknown>) {
  const payload = await postGeekAiJson<GeekAiImageResponse>('/images/generations', body)
  return extractImageSources(await settleImageTask(payload))
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
  context: ApiRequestContext,
  options?: { preferPreview?: boolean }
) {
  const uniqueIds = [...new Set(assetIds.filter(Boolean))]
  return Promise.all(uniqueIds.map(async (assetId) => {
    const record = await getAssetStorageAdapter().getRecord(assetId, context)
    const fileUrl = options?.preferPreview
      ? record.thumbnail1024Url ?? record.thumbnail512Url ?? record.originalUrl
      : record.originalUrl
    const fileName = getAssetFileName(fileUrl)
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, context)
    const bytes = Buffer.from(file)
    return `data:${mime};base64,${bytes.toString('base64')}`
  }))
}

async function settleImageTask(payload: GeekAiImageResponse) {
  if (payload.task_status === 'succeed') return payload
  if (payload.task_status === 'failed') {
    throw new Error(payload.error?.message ?? payload.message ?? 'GeekAI image generation failed.')
  }
  if (!payload.task_id) return payload

  const startedAt = Date.now()
  while (Date.now() - startedAt < pollTimeoutMs) {
    await wait(pollIntervalMs)
    const next = await getGeekAiJson<GeekAiImageResponse>(`/images/${encodeURIComponent(payload.task_id)}`)
    if (next.task_status === 'succeed') return next
    if (next.task_status === 'failed') {
      throw new Error(next.error?.message ?? next.message ?? 'GeekAI image generation failed.')
    }
  }

  throw new Error('GeekAI image generation timed out.')
}

function extractImageSources(payload: GeekAiImageResponse) {
  return (payload.data ?? []).flatMap((item) => {
    if (typeof item.url === 'string' && item.url.trim()) return [item.url.trim()]
    if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
      return [`data:${defaultGeneratedMime};base64,${item.b64_json.trim()}`]
    }
    return []
  })
}

function extractChatCompletionImageSource(payload: GeekAiChatCompletionResponse) {
  const imageValue = payload.choices?.[0]?.message?.image
  if (typeof imageValue === 'string' && imageValue.trim()) return imageValue.trim()
  if (imageValue && typeof imageValue === 'object' && !Array.isArray(imageValue)) {
    const url = typeof imageValue.url === 'string' ? imageValue.url.trim() : ''
    if (url) return url
  }
  const content = payload.choices?.[0]?.message?.content
  return extractImageUrlFromChatContent(content)
}

function extractImageUrlFromChatContent(content: GeekAiChatMessageContent | undefined) {
  const joined = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => typeof part?.text === 'string' ? part.text : '').join('\n')
      : ''
  const markdownMatch = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/.exec(joined)
  if (markdownMatch?.[1]) return markdownMatch[1]
  const urlMatch = /(https?:\/\/\S+)/.exec(joined)
  return urlMatch?.[1]?.replace(/[)>.,]+$/g, '') ?? null
}

function normalizeGeminiChatInputImage(value: string) {
  const match = /^data:[^;,]+;base64,(.+)$/s.exec(value)
  return match?.[1]?.trim() ? match[1].trim() : value
}

async function postGeekAiJson<T extends { error?: { message?: string }; message?: string }>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getGeekAiBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${getGeekAiApiKey()}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const payload = await response.json() as T
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'GeekAI request failed.')
  }
  return payload
}

async function getGeekAiJson<T extends { error?: { message?: string }; message?: string }>(path: string) {
  const response = await fetch(`${getGeekAiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${getGeekAiApiKey()}`,
    },
  })
  const payload = await response.json() as T
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'GeekAI request failed.')
  }
  return payload
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid generated image data URL.')
  const buffer = Buffer.from(match[2] ?? '', 'base64')
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  return {
    bytes,
    mime: match[1] ?? defaultGeneratedMime,
  }
}

function createGeneratedAssetTitle(prompt: string, index: number) {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Generated image'
  return index === 0 ? cleanPrompt : `${cleanPrompt} ${index + 1}`
}

function createCostHint(modelId: string, modelLabel: string, params: Record<string, unknown>) {
  const parts = [modelLabel]
  const size = normalizeGptImageSize(getString(params.size) ?? mapLegacyGptSize(getString(params.aspectRatio)))
  const quality = normalizeGptImageQuality(getString(params.quality) ?? mapLegacyGptQuality(getString(params.resolution)))
  const aspectRatio = normalizeGeminiAspectRatio(getString(params.aspectRatio))
  const imageSize = normalizeGeminiImageSize(getString(params.imageSize) ?? mapLegacyGeminiImageSize(getString(params.resolution)))
  const seedreamSize = normalizeSeedreamSize(getString(params.seedreamSize) ?? getString(params.size))
  const seedreamOutputFormat = normalizeSeedreamOutputFormat(getString(params.seedreamOutputFormat))
  const jimengSize = normalizeJimengSize(getString(params.jimengSize) ?? getString(params.size))
  const jimengStrength = normalizeJimengStrength(params.jimengStrength)

  if (modelId === 'gemini-3.1-flash-image-preview') {
    parts.push(imageSize, aspectRatio)
  } else if (modelId === 'doubao-seedream-5.0-lite') {
    parts.push(seedreamSize, seedreamOutputFormat.toUpperCase())
  } else if (modelId === 'jimeng_t2i_v40') {
    parts.push(jimengSize, `strength ${jimengStrength}`)
  } else {
    parts.push(size, quality)
  }
  return `GeekAI · ${parts.join(' · ')}`
}

function getAssetFileName(url: string) {
  const pathname = new URL(url, 'http://tangent.local').pathname
  const fileName = pathname.split('/').filter(Boolean).at(-1)
  if (!fileName) throw new Error('Asset file URL is missing a filename.')
  return fileName
}

function normalizeGptImageSize(size: string | undefined) {
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') return size
  return '1024x1024'
}

function normalizeGptImageQuality(quality: string | undefined) {
  if (quality === 'low' || quality === 'medium' || quality === 'high') return quality
  return 'medium'
}

function normalizeGeminiAspectRatio(aspectRatio: string | undefined) {
  const allowed = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '9:21', '1:4', '4:1', '1:8', '8:1'])
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '1:1'
}

function normalizeGeminiImageSize(imageSize: string | undefined) {
  if (imageSize === '0.5K' || imageSize === '1K' || imageSize === '2K' || imageSize === '4K') return imageSize
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

function normalizeJimengSize(size: string | undefined) {
  const allowed = new Set([
    '1024x1024',
    '2048x2048',
    '2304x1728',
    '2560x1440',
    '2496x1664',
    '3024x1296',
    '4096x4096',
    '4694x3520',
    '4992x3328',
    '5404x3040',
    '6198x2656',
  ])
  return size && allowed.has(size) ? size : '2048x2048'
}

function normalizeJimengStrength(value: unknown) {
  const strength = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : 0.5
  if (!Number.isFinite(strength)) return '0.5'
  return String(Math.max(0, Math.min(1, strength)))
}

function mapLegacyGptSize(aspectRatio: string | undefined) {
  if (aspectRatio === '4:3' || aspectRatio === '16:9' || aspectRatio === '3:2') return '1536x1024'
  return '1024x1024'
}

function mapLegacyGptQuality(resolution: string | undefined) {
  if (resolution === '0.5K') return 'low'
  if (resolution === '2K' || resolution === '4K') return 'high'
  return 'medium'
}

function mapLegacyGeminiImageSize(resolution: string | undefined) {
  if (resolution === '0.5K' || resolution === '2K' || resolution === '4K') return resolution
  return '1K'
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(4, Math.round(value)))
}

function createRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_local_${globalThis.crypto.randomUUID()}`
  return `run_local_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getGeekAiApiKey() {
  const value = process.env.GEEKAI_API_KEY?.trim()
  if (!value) throw new Error('Missing GEEKAI_API_KEY.')
  return value
}

function getGeekAiBaseUrl() {
  return (process.env.GEEKAI_BASE_URL ?? defaultGeekAiBaseUrl).replace(/\/+$/, '')
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}
