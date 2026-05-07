import { NextResponse } from 'next/server'
import { createMockAiRun } from '@/features/ai/mockAiContracts'
import type { AiRunRequest } from '@/features/ai/aiTypes'
import { createAiChargeSummaryForContext } from '@/features/billing/billingContracts'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { createGeekAiAnalysisRun } from '../_lib/geekAiAnalysisRun'
import { createGeekAiImageRun } from '../_lib/geekAiImageRun'
import { putLocalAiRun } from '../_lib/localAiRunStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const context = getApiRequestContext(request)
    const body = await request.json() as AiRunRequest
    const charge = createAiChargeSummaryForContext({
      userId: context.userId,
      workspaceId: context.workspaceId,
      workspaceKind: context.workspaceKind,
    })
    const run = body.runType === 'image_generation'
      ? await createGeekAiImageRun({
          charge,
          context,
          request: body,
        })
      : body.runType === 'image_analysis'
        ? await createGeekAiAnalysisRun({
            charge,
            context,
            request: body,
          })
        : createMockAiRun(body, undefined, charge)
    putLocalAiRun(run)
    return NextResponse.json({ ok: true, run })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI run failed.', ok: false },
      { status: 400 }
    )
  }
}
