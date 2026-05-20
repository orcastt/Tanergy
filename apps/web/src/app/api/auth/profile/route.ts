import { NextResponse, type NextRequest } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { readTextRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { buildAuthProxyHeaders, readJsonPayload } from '../_shared'

export const runtime = 'nodejs'
const maxAuthProfileRequestBytes = 16 * 1024

export async function PATCH(request: NextRequest) {
  const originRejection = rejectCrossSiteMutation(request)
  if (originRejection) return originRejection

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Profile updates require the FastAPI auth backend.', ok: false },
      { status: 501 },
    )
  }

  let body = ''
  try {
    body = await readTextRequestWithLimit(request, maxAuthProfileRequestBytes)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Profile update failed.', ok: false },
      { status: requestBodyErrorStatus(error) },
    )
  }
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/profile`, {
    body,
    cache: 'no-store',
    headers: await buildAuthProxyHeaders(request),
    method: 'PATCH',
  })

  const payload = await readJsonPayload(response)
  return NextResponse.json(payload, { status: response.status })
}
