import { type NextRequest } from 'next/server'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'

export async function buildAuthProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))

  copyJsonHeader(request, headers, 'content-type')

  return headers
}

export async function readJsonPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: text, ok: false }
  }
}

function copyJsonHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value && value.toLowerCase().split(';', 1)[0]?.trim() === 'application/json') {
    headers.set(name, value)
  }
}
