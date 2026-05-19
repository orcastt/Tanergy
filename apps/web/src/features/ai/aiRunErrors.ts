export class AiApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiApiError'
    this.status = status
  }
}

export function extractAiApiErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.error === 'string' && record.error.trim()) return record.error.trim()
    if (typeof record.detail === 'string' && record.detail.trim()) return record.detail.trim()
  }
  return fallback
}

export function isInsufficientCreditsError(error: unknown) {
  if (error instanceof AiApiError && error.status === 402) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /insufficient credits/i.test(message)
}
