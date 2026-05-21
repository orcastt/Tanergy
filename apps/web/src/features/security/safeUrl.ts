const controlAndWhitespaceChars = /[\u0000-\u001f\u007f\s]/g
const blockedUrlSchemes = new Set(['blob:', 'data:', 'file:', 'javascript:', 'vbscript:'])

export function safeImageDisplayUrl(value: string | null | undefined): string | null {
  const normalized = normalizeUrlInput(value)
  if (!normalized) return null
  if (normalized.startsWith('/')) return normalized.startsWith('//') ? null : normalized
  try {
    const parsed = new URL(normalized)
    if (blockedUrlSchemes.has(parsed.protocol.toLowerCase())) return null
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null
  } catch {
    return null
  }
}

export function safeExternalOpenUrl(value: string | null | undefined): string | null {
  return safeImageDisplayUrl(value)
}

export function firstSafeImageDisplayUrl(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const safe = safeImageDisplayUrl(value)
    if (safe) return safe
  }
  return null
}

function normalizeUrlInput(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const compactPrefix = trimmed.slice(0, 32).replace(controlAndWhitespaceChars, '').toLowerCase()
  for (const scheme of blockedUrlSchemes) {
    if (compactPrefix.startsWith(scheme)) return null
  }
  return trimmed
}
