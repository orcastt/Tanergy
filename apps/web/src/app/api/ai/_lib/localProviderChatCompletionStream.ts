import {
  readJsonResponseWithLimit,
  readTextResponseWithLimit,
} from './aiInlineImageGuards'

export type ProviderChatMessageContent = string | Array<{ text?: string; type?: string }>

export type ProviderChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: ProviderChatMessageContent
    }
  }>
  error?: {
    message?: string
  } | null
  message?: string
}

type ProviderClientConfig = {
  apiKey: string
  baseUrl: string
}

export async function postProviderChatCompletion(
  path: string,
  body: Record<string, unknown>,
  clientConfig: ProviderClientConfig,
) {
  const response = await fetch(`${clientConfig.baseUrl}${path}`, {
    body: JSON.stringify({ ...body, stream: true }),
    headers: {
      Accept: 'text/event-stream, application/json',
      Authorization: `Bearer ${clientConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const payload = await readChatCompletionPayload(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'Provider request failed.')
  }
  return payload
}

async function readChatCompletionPayload(response: Response): Promise<ProviderChatCompletionResponse> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/event-stream')) {
    return readJsonResponseWithLimit<ProviderChatCompletionResponse>(response)
  }
  const text = await readTextResponseWithLimit(response, 2 * 1024 * 1024)
  return parseChatCompletionSse(text)
}

function parseChatCompletionSse(text: string): ProviderChatCompletionResponse {
  const parts: string[] = []
  for (const event of text.split('\n\n')) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      const parsed = parseSseJson(data)
      if (!parsed) continue
      const delta = parsed.choices?.[0]?.delta?.content
      const message = parsed.choices?.[0]?.message?.content
      if (typeof delta === 'string') parts.push(delta)
      else if (typeof message === 'string') parts.push(message)
    }
  }
  return {
    choices: [
      {
        message: {
          content: parts.join(''),
        },
      },
    ],
  }
}

function parseSseJson(data: string) {
  try {
    const value = JSON.parse(data)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is {
  choices?: Array<{
    delta?: { content?: unknown }
    message?: { content?: unknown }
  }>
} {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
