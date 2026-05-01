import { NextResponse } from 'next/server'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    getApiRequestContext(request)
    const body = await request.json() as { document?: unknown }
    const audit = auditBoardDocument(Object.hasOwn(body, 'document') ? body.document : body)
    return NextResponse.json({ audit, ok: audit.ok }, { status: audit.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request body must be valid JSON.', ok: false },
      { status: 400 }
    )
  }
}
