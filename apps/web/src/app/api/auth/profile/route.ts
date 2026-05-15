import { NextResponse, type NextRequest } from 'next/server'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Profile updates require the FastAPI auth backend.', ok: false },
      { status: 501 },
    )
  }

  const body = await request.text()
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/profile`, {
    body,
    cache: 'no-store',
    headers: await buildProxyHeaders(request),
    method: 'PATCH',
  })

  const payload = await readJson(response)
  return NextResponse.json(payload, { status: response.status })
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders())

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

function copyHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: text, ok: false }
  }
}
