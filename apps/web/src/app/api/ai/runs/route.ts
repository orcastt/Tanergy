import { NextResponse } from 'next/server'
import type { AiRunRequest } from '@/features/ai/aiTypes'
import { createAiChargeSummaryForContext } from '@/features/billing/billingContracts'
import { assertLocalAiBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { createGeekAiAnalysisRun } from '../_lib/geekAiAnalysisRun'
import { createGeekAiImageRun } from '../_lib/geekAiImageRun'
import { putLocalAiRun } from '../_lib/localAiRunStore'

export const runtime = 'nodejs'

const maxAiRunRequestBytes = 64 * 1024

export async function POST(request: Request) {
  try {
    assertLocalAiBridgeAvailable()
    const context = getApiRequestContext(request)
    const body = await readJsonRequestWithLimit<AiRunRequest>(request, maxAiRunRequestBytes)
    validateLocalAiRunRequest(body)
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
        : null
    if (!run) {
      throw new Error('Local AI run route only supports image generation and image analysis. Use the backend AiRun API for text runs.')
    }
    putLocalAiRun(run)
    return NextResponse.json({ ok: true, run })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI run failed.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}

function validateLocalAiRunRequest(body: AiRunRequest) {
  if (body.runType !== 'image_generation' && body.runType !== 'image_analysis') {
    throw new Error('Local AI run route only supports image generation and image analysis.')
  }
  if (Array.isArray(body.inputAssetIds) && body.inputAssetIds.length > 8) {
    throw new Error('inputAssetIds must contain at most 8 assets.')
  }
  if (typeof body.prompt === 'string' && body.prompt.trim().length > 8000) {
    throw new Error('prompt must be 8000 characters or fewer.')
  }
  if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim().length > 4000) {
    throw new Error('systemPrompt must be 4000 characters or fewer.')
  }
  if (body.params) {
    const encodedParams = JSON.stringify(body.params)
    if (encodedParams.length > 16 * 1024) {
      throw new Error('params payload is too large.')
    }
  }
}
