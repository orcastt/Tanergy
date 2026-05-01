import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../../_lib/apiRequestContext'
import { getLocalAiRun } from '../../_lib/localAiRunStore'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  try {
    getApiRequestContext(request)
    const run = getLocalAiRun(runId)
    if (!run) {
      return NextResponse.json({ error: 'AI run not found.', ok: false }, { status: 404 })
    }
    return NextResponse.json({ ok: true, run })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI run lookup failed.', ok: false },
      { status: 400 }
    )
  }
}
