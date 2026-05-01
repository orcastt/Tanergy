import { NextResponse } from 'next/server'
import { createMockAiRun } from '@/features/ai/mockAiContracts'
import type { AiRunRequest } from '@/features/ai/aiTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { putLocalAiRun } from '../_lib/localAiRunStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    getApiRequestContext(request)
    const body = await request.json() as AiRunRequest
    const run = createMockAiRun(body)
    putLocalAiRun(run)
    return NextResponse.json({ ok: true, run })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI run failed.', ok: false },
      { status: 400 }
    )
  }
}
