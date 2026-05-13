import { NextResponse } from 'next/server'
import { createMockAiRun } from '@/features/ai/mockAiContracts'
import type { AiRunRequest } from '@/features/ai/aiTypes'
import { createAiChargeSummaryForContext } from '@/features/billing/billingContracts'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { createGeekAiAnalysisRun } from '../_lib/geekAiAnalysisRun'
import { createGeekAiImageRun } from '../_lib/geekAiImageRun'
import { putLocalAiRun } from '../_lib/localAiRunStore'

export const runtime = 'nodejs'

const maxAiRunRequestBytes = 64 * 1024

export async function POST(request: Request) {
  try {
    assertLocalAiRunsAllowed()
    const context = getApiRequestContext(request)
    const body = await readJsonRequestWithLimit<AiRunRequest>(request, maxAiRunRequestBytes)
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
      { status: requestBodyErrorStatus(error) }
    )
  }
}

function assertLocalAiRunsAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.TANGENT_ENABLE_LOCAL_AI_ROUTES !== '1') {
    throw new Error('Local AI routes are disabled in production. Use the backend AiRun API.')
  }
}
