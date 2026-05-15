import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../assets/_lib/assetStorageAdapter'
import { getGeekAiTextApiKey, getGeekAiTextBaseUrl } from './geekAiTextConfig'
import {
  assertAiInlineImageTotalByteLength,
  parseAiInlineImageDataUrl,
  readJsonResponseWithLimit,
  toAiInlineImageDataUrl,
} from './aiInlineImageGuards'
import { getAiModelDefinition } from '@/features/ai/mockAiContracts'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'
import type { AiRunChargeSummary } from '@/features/billing/billingTypes'

const maxAnalysisTextOutputChars = 12000
const maxAnalysisReferenceImages = 8

type GeekAiResponsesResponse = {
  error?: {
    message?: string
  } | null
  message?: string
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }> | null
    type?: string
  }>
  output_text?: string | null
}

type GeekAiChatMessageContent = string | Array<{ text?: string; type?: string }>

type GeekAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: GeekAiChatMessageContent
    }
  }>
  error?: {
    message?: string
  } | null
  message?: string
}

export async function createGeekAiAnalysisRun(input: {
  context: ApiRequestContext
  charge: AiRunChargeSummary
  request: AiRunRequest
}) {
  const startedAt = Date.now()
  const prompt = input.request.prompt?.trim()
  if (!prompt) throw new Error('Missing analysis prompt.')

  const model = getAiModelDefinition(input.request.selectedModelId)
  if (!model.capabilities.includes('image_analysis')) {
    throw new Error('The selected model does not support image analysis.')
  }
  const referenceImages = await resolveInputImages(input.request.inputAssetIds ?? [], input.context)
  if (referenceImages.length === 0) throw new Error('Missing analysis image input.')

  const textOutput = limitAnalysisTextOutput(model.id === 'gemini-2.5-flash'
    ? await runChatCompletionsAnalysis({ imageUrls: referenceImages, modelId: model.id, prompt })
    : await runResponsesAnalysis({ imageUrls: referenceImages, modelId: model.id, prompt }))
  if (!textOutput) throw new Error('GeekAI did not return any analysis text.')

  return {
    boardId: input.request.boardId ?? null,
    charge: input.charge,
    chargedAccountId: input.charge.chargedAccountId,
    chargedScope: input.charge.chargedScope,
    costCredits: 0,
    costHint: `GeekAI · ${model.displayName} · Image analysis`,
    createdAt: new Date().toISOString(),
    entitlementSource: input.charge.entitlementSource,
    error: null,
    inputAssetIds: input.request.inputAssetIds ?? [],
    latencyMs: Math.max(1, Date.now() - startedAt),
    modelId: model.id,
    nodeId: input.request.nodeId ?? null,
    outputAssetIds: [],
    provider: model.provider,
    runId: createRunId(),
    runType: 'image_analysis',
    status: 'succeeded',
    textOutput,
    workspaceKind: input.charge.workspaceKind,
    workspaceSeatId: input.charge.workspaceSeatId ?? null,
  } satisfies AiRunRecord
}

async function runResponsesAnalysis(input: { imageUrls: string[]; modelId: string; prompt: string }) {
  const payload = await postGeekAiJson<GeekAiResponsesResponse>('/responses', {
    input: [
      {
        content: [
          { text: input.prompt, type: 'input_text' },
          ...input.imageUrls.map((imageUrl) => ({
            image_url: imageUrl,
            type: 'input_image',
          })),
        ],
        role: 'user',
        type: 'message',
      },
    ],
    max_output_tokens: 1200,
    model: input.modelId,
    stream: false,
    text: {
      format: {
        type: 'text',
      },
    },
  })
  return extractResponseText(payload).trim()
}

async function runChatCompletionsAnalysis(input: { imageUrls: string[]; modelId: string; prompt: string }) {
  const payload = await postGeekAiJson<GeekAiChatCompletionResponse>('/chat/completions', {
    max_completion_tokens: 1200,
    messages: [
      {
        content: [
          { text: input.prompt, type: 'text' },
          ...input.imageUrls.map((imageUrl) => ({
            image_url: {
              url: normalizeChatCompletionImageUrl(imageUrl),
            },
            type: 'image_url',
          })),
        ],
        role: 'user',
      },
    ],
    model: input.modelId,
    stream: false,
  })
  return extractChatCompletionText(payload).trim()
}

async function resolveInputImages(assetIds: string[], context: ApiRequestContext) {
  const uniqueIds = [...new Set(assetIds.filter(Boolean))]
  if (uniqueIds.length > maxAnalysisReferenceImages) {
    throw new Error(`Image analysis accepts up to ${maxAnalysisReferenceImages} reference images.`)
  }
  const imageUrls: string[] = []
  let totalInlineBytes = 0
  for (const assetId of uniqueIds) {
    const record = await getAssetStorageAdapter().getRecord(assetId, context)
    const fileUrl = record.thumbnail1024Url ?? record.thumbnail512Url ?? record.originalUrl
    const fileName = getAssetFileName(fileUrl)
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, context)
    totalInlineBytes += file.byteLength
    assertAiInlineImageTotalByteLength(totalInlineBytes, 'Reference images exceed the total allowed size for image analysis.')
    imageUrls.push(toAiInlineImageDataUrl(mime, file))
  }
  return imageUrls
}

function extractResponseText(payload: GeekAiResponsesResponse) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  return (payload.output ?? [])
    .flatMap((item) => item.type === 'message' && Array.isArray(item.content) ? item.content : [])
    .flatMap((part) => part.type === 'output_text' && typeof part.text === 'string' ? [part.text] : [])
    .join('\n')
}

function extractChatCompletionText(payload: GeekAiChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n')
  }
  return ''
}

function limitAnalysisTextOutput(value: string) {
  return value.length > maxAnalysisTextOutputChars ? value.slice(0, maxAnalysisTextOutputChars) : value
}

function normalizeChatCompletionImageUrl(value: string) {
  return value.startsWith('data:') ? parseAiInlineImageDataUrl(value).base64 : value
}

async function postGeekAiJson<T extends { error?: { message?: string } | null; message?: string }>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getGeekAiBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${getGeekAiTextApiKey()}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const payload = await readJsonResponseWithLimit<T>(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'GeekAI request failed.')
  }
  return payload
}

function getAssetFileName(url: string) {
  const pathname = new URL(url, 'http://tangent.local').pathname
  const fileName = pathname.split('/').filter(Boolean).at(-1)
  if (!fileName) throw new Error('Asset file URL is missing a filename.')
  return fileName
}

function createRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `run_local_${globalThis.crypto.randomUUID()}`
  return `run_local_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getGeekAiBaseUrl() {
  return getGeekAiTextBaseUrl()
}
