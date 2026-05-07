import { NextResponse } from 'next/server'
import type { AiChatCompletionRequest, AiChatMessage, AiChatMessageContentPart } from '@/features/ai/aiTypes'
import { getApiRequestContext } from '../../../_lib/apiRequestContext'

export const runtime = 'nodejs'

const defaultGeekAiBaseUrl = 'https://geekai.co/api/v1'

export async function POST(request: Request) {
  try {
    const body = await request.json() as AiChatCompletionRequest
    if (!body.model?.trim()) {
      return NextResponse.json({ error: 'Missing chat model.' }, { status: 400 })
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Missing chat messages.' }, { status: 400 })
    }

    const apiKey = process.env.GEEKAI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEEKAI_API_KEY.' }, { status: 503 })
    }

    const normalizedMessages = await normalizeMessagesForGeekAi(request, body.messages)
    const geekAiResponse = await fetch(`${getGeekAiBaseUrl()}/chat/completions`, {
      body: JSON.stringify({
        ...body,
        messages: normalizedMessages,
        stream: body.stream ?? true,
      }),
      headers: {
        Accept: 'text/event-stream, application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!geekAiResponse.ok) {
      return NextResponse.json(
        { error: await getGeekAiError(geekAiResponse) },
        { status: geekAiResponse.status }
      )
    }

    if (!body.stream || !geekAiResponse.body) {
      const payload = await geekAiResponse.json()
      return NextResponse.json(payload, { status: geekAiResponse.status })
    }

    return new Response(geekAiResponse.body, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': geekAiResponse.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
      },
      status: geekAiResponse.status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat completion failed.' },
      { status: 400 }
    )
  }
}

async function normalizeMessagesForGeekAi(request: Request, messages: AiChatMessage[]) {
  return Promise.all(messages.map(async (message) => {
    if (!Array.isArray(message.content)) return message
    return {
      ...message,
      content: await Promise.all(message.content.map(async (part) => normalizeMessagePart(request, part))),
    }
  }))
}

async function normalizeMessagePart(request: Request, part: AiChatMessageContentPart) {
  if (part.type !== 'image_url') return part
  const rawUrl = part.image_url?.url?.trim()
  if (!rawUrl) return part
  return {
    ...part,
    image_url: {
      ...part.image_url,
      url: await resolveGeekAiImageUrl(request, rawUrl),
    },
  }
}

async function resolveGeekAiImageUrl(request: Request, rawUrl: string) {
  if (rawUrl.startsWith('data:')) return rawUrl
  const requestUrl = new URL(request.url)
  const resolvedUrl = new URL(rawUrl, requestUrl)
  if (!shouldInlineImageUrl(requestUrl, resolvedUrl)) return resolvedUrl.toString()

  const assetResponse = await fetch(resolvedUrl, {
    headers: getForwardHeaders(request),
  })
  if (!assetResponse.ok) {
    throw new Error(`Failed to load reference image (${assetResponse.status}).`)
  }

  const bytes = Buffer.from(await assetResponse.arrayBuffer())
  const mime = assetResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function shouldInlineImageUrl(requestUrl: URL, targetUrl: URL) {
  if (!['http:', 'https:'].includes(targetUrl.protocol)) return false
  if (targetUrl.origin === requestUrl.origin) return true
  if (targetUrl.hostname === '127.0.0.1' || targetUrl.hostname === 'localhost') return true
  const apiBaseOrigin = getOptionalOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
  return Boolean(apiBaseOrigin && targetUrl.origin === apiBaseOrigin)
}

function getForwardHeaders(request: Request) {
  const context = getApiRequestContext(request)
  const headers = new Headers()
  headers.set('x-tangent-user-id', context.userId)
  headers.set('x-tangent-workspace-id', context.workspaceId)
  headers.set('x-tangent-workspace-kind', context.workspaceKind)
  if (context.workspacePlanKey) headers.set('x-tangent-plan-key', context.workspacePlanKey)
  const authorization = request.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)
  return headers
}

async function getGeekAiError(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message ?? payload.message ?? 'GeekAI request failed.'
  }
  return (await response.text()) || 'GeekAI request failed.'
}

function getGeekAiBaseUrl() {
  return (process.env.GEEKAI_BASE_URL ?? defaultGeekAiBaseUrl).replace(/\/+$/, '')
}

function getOptionalOrigin(value: null | string | undefined) {
  if (!value?.trim()) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
