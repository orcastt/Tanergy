import type { TangentUser } from './sessionTypes'

type UpdateCurrentAuthProfileInput = {
  displayName: string
}

type DeleteCurrentAuthAccountInput = {
  confirmation: string
  reason?: string
}

export type AuthAccountDeleteBlocker = {
  code?: string
  message?: string
  workspaceName?: string
}

export type AuthAccountDeleteErrorDetail = {
  blockers?: AuthAccountDeleteBlocker[]
  error?: string
  message?: string
}

type AuthAccountDeleteResponse = {
  detail?: unknown
  error?: string
  message?: string
  ok: boolean
  warning?: string
}

type AuthProfileUpdateResponse = {
  error?: string
  ok: boolean
  user?: TangentUser
}

export async function updateCurrentAuthProfile(input: UpdateCurrentAuthProfileInput) {
  const response = await fetch('/api/auth/profile', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  const payload = await readProfilePayload(response)
  if (!response.ok || !payload.ok || !payload.user) {
    throw new Error(payload.error || 'Profile update failed.')
  }
  return payload.user
}

export async function deleteCurrentAuthAccount(input: DeleteCurrentAuthAccountInput) {
  const response = await fetch('/api/auth/account', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
  })
  const payload = await readDeletePayload(response)
  if (!response.ok || !payload.ok || !payload.message) {
    throw new AuthAccountDeleteError(
      payload.error || formatDeleteFailureDetail(payload.detail) || 'Account deletion failed.',
      readDeleteErrorDetail(payload.detail),
    )
  }
  return payload
}

async function readProfilePayload(response: Response): Promise<AuthProfileUpdateResponse> {
  const text = await response.text()
  if (!text) return { error: 'Profile update failed.', ok: false }
  try {
    return JSON.parse(text) as AuthProfileUpdateResponse
  } catch {
    return { error: text, ok: false }
  }
}

async function readDeletePayload(response: Response): Promise<AuthAccountDeleteResponse> {
  const text = await response.text()
  if (!text) return { error: 'Account deletion failed.', ok: false }
  try {
    return JSON.parse(text) as AuthAccountDeleteResponse
  } catch {
    return { error: text, ok: false }
  }
}

function formatDeleteFailureDetail(detail: unknown): string | null {
  const parsed = readDeleteErrorDetail(detail)
  if (!parsed) {
    return typeof detail === 'string' && detail.trim() ? detail.trim() : null
  }
  const message = typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : null
  const blockerLabels = Array.isArray(parsed.blockers)
    ? parsed.blockers
      .map((blocker) => {
        if (typeof blocker?.message === 'string' && blocker.message.trim()) return blocker.message.trim()
        if (typeof blocker?.workspaceName === 'string' && blocker.workspaceName.trim()) return blocker.workspaceName.trim()
        if (typeof blocker?.code === 'string' && blocker.code.trim()) return blocker.code.trim().replaceAll('_', ' ')
        return null
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
    : []
  if (!message && blockerLabels.length === 0) {
    return null
  }
  if (blockerLabels.length === 0) {
    return message
  }
  return `${message ?? 'Account deletion is blocked.'} ${blockerLabels.join(' · ')}`
}

function readDeleteErrorDetail(detail: unknown): AuthAccountDeleteErrorDetail | null {
  if (!detail || typeof detail !== 'object') {
    return null
  }
  const record = detail as AuthAccountDeleteErrorDetail
  return record
}

export class AuthAccountDeleteError extends Error {
  detail: AuthAccountDeleteErrorDetail | null

  constructor(message: string, detail: AuthAccountDeleteErrorDetail | null) {
    super(message)
    this.detail = detail
    this.name = 'AuthAccountDeleteError'
  }
}
