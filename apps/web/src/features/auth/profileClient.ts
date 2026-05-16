import type { TangentUser } from './sessionTypes'

type UpdateCurrentAuthProfileInput = {
  displayName: string
}

type DeleteCurrentAuthAccountInput = {
  confirmation: string
  reason?: string
}

type AuthAccountDeleteResponse = {
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
    throw new Error(payload.error || 'Account deletion failed.')
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
