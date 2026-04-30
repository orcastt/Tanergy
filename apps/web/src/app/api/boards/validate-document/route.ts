import { NextResponse } from 'next/server'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { document?: unknown }
    const audit = auditBoardDocument(Object.hasOwn(body, 'document') ? body.document : body)
    return NextResponse.json({ audit, ok: audit.ok }, { status: audit.ok ? 200 : 422 })
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', ok: false },
      { status: 400 }
    )
  }
}
