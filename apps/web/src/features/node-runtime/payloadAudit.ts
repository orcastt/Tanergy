import type { JsonValue } from '@tldraw/utils'

const disallowedPrefixes = ['data:', 'blob:']

export type PayloadAuditResult = {
  byteSize: number
  issues: string[]
}

export function auditNodePayload(payload: JsonValue): PayloadAuditResult {
  const json = JSON.stringify(payload)
  const issues: string[] = []

  walkPayload(payload, [], issues)

  if (json.length > 8_000) {
    issues.push(`Payload is ${json.length} chars; keep node props lightweight`)
  }

  return {
    byteSize: new TextEncoder().encode(json).length,
    issues,
  }
}

function walkPayload(value: JsonValue, path: string[], issues: string[]) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (disallowedPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
      issues.push(`${formatPath(path)} contains a runtime URL (${trimmed.slice(0, 5)}…)`)
    }
    if (trimmed.length > 2_000) {
      issues.push(`${formatPath(path)} is too long for shape props`)
    }
    return
  }

  if (!value || typeof value !== 'object') return

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPayload(item, [...path, String(index)], issues))
    return
  }

  Object.entries(value).forEach(([key, item]) => {
    if (item !== undefined) walkPayload(item, [...path, key], issues)
  })
}

function formatPath(path: string[]) {
  return path.length > 0 ? path.join('.') : 'payload'
}
