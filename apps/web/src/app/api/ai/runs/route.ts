import { NextResponse } from 'next/server'
import { createMockAiRun } from '@/features/ai/mockAiContracts'
import type { AiRunRequest } from '@/features/ai/aiTypes'
import { createAiChargeSummaryForContext } from '@/features/billing/billingContracts'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { putLocalAiRun } from '../_lib/localAiRunStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const context = getApiRequestContext(request)
    const body = await request.json() as AiRunRequest
    const run = createMockAiRun(
      body,
      undefined,
      createAiChargeSummaryForContext({
        userId: context.userId,
        workspaceId: context.workspaceId,
        workspaceKind: context.workspaceKind,
      })
    )
    putLocalAiRun(run)
    return NextResponse.json({ ok: true, run })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI run failed.', ok: false },
      { status: 400 }
    )
  }
}
