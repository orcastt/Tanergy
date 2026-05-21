'use client'

import { persistenceJsonHeadersAsync } from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { AiChatCompletionRequest } from './aiTypes'

type StreamOptions = {
  maxBufferChars?: number
  maxOutputChars?: number
  onComplete?: (text: string) => void
  onDelta?: (delta: string) => void
  signal?: AbortSignal
  workspace?: TangentWorkspace
}

const defaultMaxOutputChars = 4000
const defaultMaxBufferChars = 64_000

export async function streamAiChatCompletion(
  input: AiChatCompletionRequest,
  options: StreamOptions = {}
) {
  const maxOutputChars = getPositiveLimit(options.maxOutputChars, defaultMaxOutputChars)
  const maxBufferChars = getPositiveLimit(options.maxBufferChars, defaultMaxBufferChars)
  const headers = await persistenceJsonHeadersAsync(options.workspace)
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
    const text = getChatContentText(payload.choices?.[0]?.message?.content).slice(0, maxOutputChars)
    if (text) options.onDelta?.(text)
    options.onComplete?.(text)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let shouldCancelReader = true

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) shouldCancelReader = false
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      if (buffer.length > maxBufferChars) {
        throw new Error('Chat completion stream exceeded the buffered event limit.')
      }
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
          shouldCancelReader = false
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
        const acceptedDelta = appendCappedDelta(fullText, delta, maxOutputChars)
        if (!acceptedDelta) continue
        fullText += acceptedDelta
        options.onDelta?.(acceptedDelta)
        if (fullText.length >= maxOutputChars) {
          options.onComplete?.(fullText)
          return fullText
        }
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
        const acceptedDelta = appendCappedDelta(fullText, text, maxOutputChars)
        if (acceptedDelta && !fullText) {
          fullText = acceptedDelta
          options.onDelta?.(acceptedDelta)
        }
      }
    }

    options.onComplete?.(fullText)
    return fullText
  } finally {
    buffer = ''
    if (shouldCancelReader) {
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
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

function appendCappedDelta(currentText: string, delta: string, maxChars: number) {
  if (!delta || currentText.length >= maxChars) return ''
  return delta.slice(0, maxChars - currentText.length)
}

function getPositiveLimit(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}
