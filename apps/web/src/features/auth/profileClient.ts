import type { TangentUser } from './sessionTypes'

type UpdateCurrentAuthProfileInput = {
  displayName: string
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

async function readProfilePayload(response: Response): Promise<AuthProfileUpdateResponse> {
  const text = await response.text()
  if (!text) return { error: 'Profile update failed.', ok: false }
  try {
    return JSON.parse(text) as AuthProfileUpdateResponse
  } catch {
    return { error: text, ok: false }
  }
}
