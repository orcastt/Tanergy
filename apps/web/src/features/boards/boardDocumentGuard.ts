export type BoardDocumentGuardIssueCode =
  | 'document-not-json'
  | 'document-too-large'
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

const runtimeUrlPrefixes = ['data:', 'blob:']

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
  const runtimePrefix = runtimeUrlPrefixes.find((prefix) => trimmed.startsWith(prefix))
  if (runtimePrefix) {
    issues.push({
      blocking: true,
      code: 'runtime-url',
      message: `${formatPath(path)} contains a ${runtimePrefix} runtime URL; upload it as an Asset before saving.`,
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

function isLikelyLargeBase64(value: string, minLength: number) {
  if (value.length < minLength) return false
  if (/\s/.test(value)) return false
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false
  return value.length % 4 === 0
}

function formatPath(path: string[]) {
  return path.length > 0 ? path.join('.') : 'document'
}
