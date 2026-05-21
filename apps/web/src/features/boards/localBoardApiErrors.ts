'use client'

type BoardApiAuditIssue = {
  message?: string
}

type BoardApiErrorPayload = {
  audit?: {
    issues?: BoardApiAuditIssue[]
  }
  detail?: unknown
  error?: string
  message?: string
}

export async function readBoardApiPayload<T>(response: Response): Promise<T | BoardApiErrorPayload> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as T
  } catch {
    return { detail: text }
  }
}

export function resolveBoardApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const typedPayload = payload as BoardApiErrorPayload
  return (
    describeBoardApiDetail(typedPayload.detail)
    ?? typedPayload.audit?.issues?.find((issue) => typeof issue.message === 'string' && issue.message.trim())?.message?.trim()
    ?? typedPayload.error?.trim()
    ?? typedPayload.message?.trim()
    ?? fallback
  )
}

function describeBoardApiDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const nextMessage = describeBoardApiDetail(item)
      if (nextMessage) return nextMessage
    }
    return null
  }
  if (!detail || typeof detail !== 'object') return null
  const record = detail as Record<string, unknown>
  const message = typeof record.msg === 'string' && record.msg.trim()
    ? record.msg.trim()
    : typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : typeof record.detail === 'string' && record.detail.trim()
        ? record.detail.trim()
        : null
  if (!message) return null
  if (!Array.isArray(record.loc) || record.loc.length === 0) return message
  const location = record.loc
    .filter((item): item is number | string => typeof item === 'number' || typeof item === 'string')
    .join(' > ')
    .trim()
  return location ? `${location}: ${message}` : message
}
