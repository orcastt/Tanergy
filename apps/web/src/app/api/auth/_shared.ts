import { type NextRequest } from 'next/server'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'

export async function buildAuthProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))

  copyHeader(request, headers, 'authorization')
  copyHeader(request, headers, 'content-type')
  copyHeader(request, headers, 'cookie')
  copyHeader(request, headers, 'x-tangent-user-id')
  copyHeader(request, headers, 'x-tangent-workspace-id')
  copyHeader(request, headers, 'x-tangent-workspace-kind')
  copyHeader(request, headers, 'x-tangent-workspace-name')
  copyHeader(request, headers, 'x-tangent-workspace-role')
  copyHeader(request, headers, 'x-tangent-plan-key')

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

function copyHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}
