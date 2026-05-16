import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthProxyHeaders, readJsonPayload } from '../_shared'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Account deletion requires the FastAPI auth backend.', ok: false },
      { status: 501 },
    )
  }

  const body = await request.text()
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/account`, {
    body,
    cache: 'no-store',
    headers: await buildAuthProxyHeaders(request),
    method: 'DELETE',
  })

  const payload = await readJsonPayload(response)
  return NextResponse.json(payload, { status: response.status })
}
