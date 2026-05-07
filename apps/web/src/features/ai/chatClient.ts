'use client'

import { persistenceJsonHeadersAsync } from '@/features/api/persistenceApi'
import type { AiChatCompletionRequest } from './aiTypes'

type StreamOptions = {
  onComplete?: (text: string) => void
  onDelta?: (delta: string) => void
  signal?: AbortSignal
}

export async function streamAiChatCompletion(
  input: AiChatCompletionRequest,
  options: StreamOptions = {}
) {
  const headers = await persistenceJsonHeadersAsync()
  const response = await fetch('/api/ai/chat/completions', {
    body: JSON.stringify({ ...input, stream: true }),
    headers,
    method: 'POST',
    signal: options.signal,
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    const errorMessage = contentType.includes('application/json')
      ? (await response.json() as { error?: string }).error
      : await response.text()
    throw new Error(errorMessage || 'Chat completion failed.')
  }

  if (!response.body) throw new Error('Missing chat response stream.')

  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | unknown[] } }>
    }
    const text = getChatContentText(payload.choices?.[0]?.message?.content)
    if (text) options.onDelta?.(text)
    options.onComplete?.(text)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
      if (dataLines.length === 0) continue
      const data = dataLines.join('\n')
      if (data === '[DONE]') {
        options.onComplete?.(fullText)
        return fullText
      }
      const payload = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string | unknown[]
          }
          message?: {
            content?: string | unknown[]
          }
        }>
      }
      const delta = getChatContentText(
        payload.choices?.[0]?.delta?.content
        ?? payload.choices?.[0]?.message?.content
      )
      if (!delta) continue
      fullText += delta
      options.onDelta?.(delta)
    }

    if (done) break
  }

  if (buffer.trim()) {
    const tail = buffer
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .find((line) => line && line !== '[DONE]')
    if (tail) {
      const payload = JSON.parse(tail) as {
        choices?: Array<{ message?: { content?: string | unknown[] } }>
      }
      const text = getChatContentText(payload.choices?.[0]?.message?.content)
      if (text && !fullText) {
        fullText = text
        options.onDelta?.(text)
      }
    }
  }

  options.onComplete?.(fullText)
  return fullText
}

function getChatContentText(content: string | unknown[] | undefined) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (!part || typeof part !== 'object' || Array.isArray(part)) return ''
    const value = part as Record<string, unknown>
    return value.type === 'text' && typeof value.text === 'string' ? value.text : ''
  }).join('')
}
