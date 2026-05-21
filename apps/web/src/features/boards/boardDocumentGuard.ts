import { auditKonvaBoardDocumentSchema } from './boardKonvaDocumentGuard'

export type BoardDocumentGuardIssueCode =
  | 'document-not-json'
  | 'document-too-large'
  | 'konva-v2-invalid'
  | 'legacy-tldraw-document'
  | 'large-base64-string'
  | 'runtime-url'

export type BoardDocumentGuardIssue = {
  blocking: boolean
  code: BoardDocumentGuardIssueCode
  message: string
  path: string
}

export type BoardDocumentGuardResult = {
  byteSize: number
  issues: BoardDocumentGuardIssue[]
  ok: boolean
}

type BoardDocumentGuardOptions = {
  maxBase64StringLength?: number
  maxDocumentBytes?: number
}

const defaultOptions = {
  maxBase64StringLength: 2_048,
  maxDocumentBytes: 2_000_000,
} satisfies Required<BoardDocumentGuardOptions>

const controlAndWhitespaceChars = /[\u0000-\u001f\u007f\s]/g
const unsafeUrlPrefixes = ['blob:', 'data:', 'file:', 'javascript:', 'vbscript:']
const boardUrlFieldNames = new Set([
  'imageUrl',
  'originalUrl',
  'sourceUrl',
  'thumbnail1024Url',
  'thumbnail256Url',
  'thumbnail512Url',
  'thumbnailUrl',
  'url',
])

export function auditBoardDocument(
  document: unknown,
  options: BoardDocumentGuardOptions = {}
): BoardDocumentGuardResult {
  const resolvedOptions = { ...defaultOptions, ...options }
  const issues: BoardDocumentGuardIssue[] = []
  const json = safeStringify(document, issues)
  const byteSize = json ? new TextEncoder().encode(json).length : 0

  if (json && byteSize > resolvedOptions.maxDocumentBytes) {
    issues.push({
      blocking: true,
      code: 'document-too-large',
      message: `Board document is ${byteSize} bytes; split heavy data into Asset / AiRun records before saving.`,
      path: 'document',
    })
  }

  walkDocument(document, [], issues, resolvedOptions)
  if (isLegacyTldrawBoardDocument(document)) {
    issues.push({
      blocking: true,
      code: 'legacy-tldraw-document',
      message: 'Legacy tldraw board documents are no longer supported in the Konva-only app path.',
      path: 'document',
    })
  }
  issues.push(...auditKonvaBoardDocumentSchema(document))

  return {
    byteSize,
    issues,
    ok: issues.every((issue) => !issue.blocking),
  }
}

export function assertBoardDocumentCanPersist(document: unknown) {
  const audit = auditBoardDocument(document)
  if (!audit.ok) {
    throw new Error(audit.issues.find((issue) => issue.blocking)?.message ?? 'Board document is not persistable.')
  }
  return audit
}

export function isLegacyTldrawBoardDocument(document: unknown) {
  if (!document || typeof document !== 'object') return false
  const candidate = document as {
    camera?: unknown
    runtimeEdges?: unknown
    shapes?: unknown
    version?: unknown
  }
  return (
    candidate.version === 1
    && Array.isArray(candidate.shapes)
    && Array.isArray(candidate.runtimeEdges)
    && Boolean(candidate.camera && typeof candidate.camera === 'object')
  )
}

function safeStringify(document: unknown, issues: BoardDocumentGuardIssue[]) {
  try {
    const json = JSON.stringify(document)
    if (typeof json === 'string') return json
  } catch {
    // handled below
  }

  issues.push({
    blocking: true,
    code: 'document-not-json',
    message: 'Board document must be JSON serializable before saving.',
    path: 'document',
  })
  return null
}

function walkDocument(
  value: unknown,
  path: string[],
  issues: BoardDocumentGuardIssue[],
  options: Required<BoardDocumentGuardOptions>
) {
  if (typeof value === 'string') {
    auditString(value, path, issues, options)
    return
  }

  if (!value || typeof value !== 'object') return

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkDocument(item, [...path, String(index)], issues, options))
    return
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (item !== undefined) walkDocument(item, [...path, key], issues, options)
  })
}

function auditString(
  value: string,
  path: string[],
  issues: BoardDocumentGuardIssue[],
  options: Required<BoardDocumentGuardOptions>
) {
  const trimmed = value.trim()
  const unsafePrefix = getUnsafeUrlPrefix(trimmed)
  if (unsafePrefix) {
    issues.push({
      blocking: true,
      code: 'runtime-url',
      message: `${formatPath(path)} contains an unsafe ${unsafePrefix} URL; upload it as an Asset before saving.`,
      path: formatPath(path),
    })
    return
  }

  if (isBoardUrlField(path) && !isAllowedBoardUrl(trimmed)) {
    issues.push({
      blocking: true,
      code: 'runtime-url',
      message: `${formatPath(path)} contains an unsupported URL; use http(s) or an uploaded Asset URL before saving.`,
      path: formatPath(path),
    })
    return
  }

  if (isLikelyLargeBase64(trimmed, options.maxBase64StringLength)) {
    issues.push({
      blocking: true,
      code: 'large-base64-string',
      message: `${formatPath(path)} looks like a large base64 payload; store binary data in Asset storage instead.`,
      path: formatPath(path),
    })
  }
}

function getUnsafeUrlPrefix(value: string) {
  const compactPrefix = value.slice(0, 32).replace(controlAndWhitespaceChars, '').toLowerCase()
  return unsafeUrlPrefixes.find((prefix) => compactPrefix.startsWith(prefix)) ?? null
}

function isBoardUrlField(path: string[]) {
  const key = path[path.length - 1]
  return typeof key === 'string' && boardUrlFieldNames.has(key)
}

function isAllowedBoardUrl(value: string) {
  if (!value) return true
  if (value.startsWith('/')) return !value.startsWith('//')
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyLargeBase64(value: string, minLength: number) {
  if (value.length < minLength) return false
  if (/\s/.test(value)) return false
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false
  return value.length % 4 === 0
}

function formatPath(path: string[]) {
  return path.length > 0 ? path.join('.') : 'document'
}
