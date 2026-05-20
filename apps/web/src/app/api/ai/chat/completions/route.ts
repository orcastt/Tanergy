import { NextResponse } from 'next/server'
import type { AiChatCompletionRequest, AiChatMessage, AiChatMessageContentPart } from '@/features/ai/aiTypes'
import { getAiModelDefinition } from '@/features/ai/mockAiContracts'
import { assertLocalAiBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'
import { rejectCrossSiteMutation } from '../../../_lib/csrfGuard'
import { getApiRequestContext } from '../../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../../_lib/requestBodyLimits'
import { getProviderApiKey, getProviderBaseUrl } from '../../_lib/providerApiConfig'
import {
  assertAiInlineImageByteLength,
  assertAiInlineImageTotalByteLength,
  getResponseContentLength,
  parseAiInlineImageDataUrl,
  normalizeAiInlineImageMime,
  readAiInlineResponseBufferWithLimit,
  readJsonResponseWithLimit,
  readTextResponseWithLimit,
} from '../../_lib/aiInlineImageGuards'

export const runtime = 'nodejs'

const maxChatMessages = 32
const maxChatContentParts = 64
const maxChatImageParts = 8
const maxChatRequestBytes = 1024 * 1024
const maxChatProviderStreamBytes = 2 * 1024 * 1024
const chatProviderStreamTimeoutMs = 120_000

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    assertLocalAiBridgeAvailable()
    const body = await readJsonRequestWithLimit<AiChatCompletionRequest>(request, maxChatRequestBytes)
    if (!body.model?.trim()) {
      return NextResponse.json({ error: 'Missing chat model.' }, { status: 400 })
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Missing chat messages.' }, { status: 400 })
    }

    const model = getAiModelDefinition(body.model)
    const apiKey = getProviderApiKey(model.provider, 'text')
    const baseUrl = getProviderBaseUrl(model.provider, 'text')

    const providerMessages = await normalizeMessagesForProvider(request, body.messages)
    const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      body: JSON.stringify({
        ...body,
        messages: providerMessages,
        stream: body.stream ?? true,
      }),
      headers: {
        Accept: 'text/event-stream, application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!providerResponse.ok) {
      return NextResponse.json(
        { error: await getProviderError(providerResponse) },
        { status: providerResponse.status }
      )
    }

    if (!body.stream || !providerResponse.body) {
      const payload = await readJsonResponseWithLimit(providerResponse)
      return NextResponse.json(payload, { status: providerResponse.status })
    }

    return new Response(createCappedProviderStream(providerResponse.body), {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': providerResponse.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
      },
      status: providerResponse.status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat completion failed.' },
      { status: requestBodyErrorStatus(error) }
    )
  }
}

async function normalizeMessagesForProvider(request: Request, messages: AiChatMessage[]) {
  if (messages.length > maxChatMessages) throw new Error('Chat request includes too many messages.')
  let imagePartCount = 0
  const usage = { totalInlineBytes: 0 }
  const normalizedMessages: AiChatMessage[] = []
  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      normalizedMessages.push(message)
      continue
    }
    if (message.content.length > maxChatContentParts) throw new Error('Chat request includes too many content parts.')
    const content: AiChatMessageContentPart[] = []
    for (const part of message.content) {
      if (part.type === 'image_url') {
        imagePartCount += 1
        if (imagePartCount > maxChatImageParts) throw new Error('Chat request includes too many reference images.')
      }
      content.push(await normalizeMessagePart(request, part, usage))
    }
    normalizedMessages.push({
      ...message,
      content,
    })
  }
  return normalizedMessages
}

async function normalizeMessagePart(
  request: Request,
  part: AiChatMessageContentPart,
  usage: { totalInlineBytes: number }
) {
  if (part.type !== 'image_url') return part
  const rawUrl = part.image_url?.url?.trim()
  if (!rawUrl) return part
  return {
    ...part,
      image_url: {
        ...part.image_url,
        url: await resolveProviderImageUrl(request, rawUrl, usage),
      },
  }
}

async function resolveProviderImageUrl(request: Request, rawUrl: string, usage: { totalInlineBytes: number }) {
  if (rawUrl.startsWith('data:')) {
    const parsed = parseAiInlineImageDataUrl(rawUrl)
    usage.totalInlineBytes += parsed.buffer.byteLength
    assertAiInlineImageTotalByteLength(usage.totalInlineBytes)
    return `data:${parsed.mime};base64,${parsed.base64}`
  }
  const requestUrl = new URL(request.url)
  const resolvedUrl = new URL(rawUrl, requestUrl)
  if (!shouldInlineImageUrl(requestUrl, resolvedUrl)) return resolvedUrl.toString()

  const assetResponse = await fetch(resolvedUrl, {
    headers: await getForwardHeaders(request),
  })
  if (!assetResponse.ok) {
    throw new Error(`Failed to load reference image (${assetResponse.status}).`)
  }

  const mime = normalizeAiInlineImageMime(assetResponse.headers.get('content-type'))
  assertAiInlineImageByteLength(getResponseContentLength(assetResponse.headers))
  const bytes = await readAiInlineResponseBufferWithLimit(assetResponse)
  usage.totalInlineBytes += bytes.byteLength
  assertAiInlineImageTotalByteLength(usage.totalInlineBytes)
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function shouldInlineImageUrl(requestUrl: URL, targetUrl: URL) {
  if (!['http:', 'https:'].includes(targetUrl.protocol)) return false
  if (targetUrl.origin === requestUrl.origin) return true
  if (targetUrl.hostname === '127.0.0.1' || targetUrl.hostname === 'localhost') return true
  const apiBaseOrigin = getOptionalOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
  return Boolean(apiBaseOrigin && targetUrl.origin === apiBaseOrigin)
}

async function getForwardHeaders(request: Request) {
  const context = getApiRequestContext(request)
  const headers = new Headers(await buildServerClerkApiHeaders())
  headers.set('x-tangent-user-id', context.userId)
  headers.set('x-tangent-workspace-id', context.workspaceId)
  return headers
}

async function getProviderError(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await readJsonResponseWithLimit<{ error?: { message?: string }; message?: string }>(response)
    return payload.error?.message ?? payload.message ?? 'Provider request failed.'
  }
  return (await readTextResponseWithLimit(response)) || 'Provider request failed.'
}

function createCappedProviderStream(source: ReadableStream<Uint8Array>) {
  const reader = source.getReader()
  let totalBytes = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  let didFinish = false

  const cleanup = () => {
    didFinish = true
    if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      timeout = setTimeout(() => {
        if (didFinish) return
        cleanup()
        void reader.cancel().catch(() => {})
        controller.error(new Error('Chat completion stream timed out.'))
      }, chatProviderStreamTimeoutMs)
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          cleanup()
          controller.close()
          return
        }
        if (!value) return
        totalBytes += value.byteLength
        if (totalBytes > maxChatProviderStreamBytes) {
          cleanup()
          await reader.cancel().catch(() => {})
          controller.error(new Error('Chat completion stream exceeded the response size limit.'))
          return
        }
        controller.enqueue(value)
      } catch (error) {
        cleanup()
        controller.error(error)
      }
    },
    async cancel(reason) {
      cleanup()
      await reader.cancel(reason).catch(() => {})
    },
  })
}

function getOptionalOrigin(value: null | string | undefined) {
  if (!value?.trim()) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
