import { NextResponse } from 'next/server'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'

export const runtime = 'nodejs'

const maxBoardValidationRequestBytes = 3 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    getApiRequestContext(request)
    const body = await readJsonRequestWithLimit<{ document?: unknown }>(request, maxBoardValidationRequestBytes)
    const audit = auditBoardDocument(Object.hasOwn(body, 'document') ? body.document : body)
    return NextResponse.json({ audit, ok: audit.ok }, { status: audit.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request body must be valid JSON.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}
