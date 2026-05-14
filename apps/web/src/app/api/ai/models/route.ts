import { NextResponse } from 'next/server'
import { getAiModels } from '@/features/ai/mockAiContracts'
import type { AiCapability } from '@/features/ai/aiTypes'
import { assertLocalAiBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { requestBodyErrorStatus } from '../../_lib/requestBodyLimits'

export const runtime = 'nodejs'

export function GET(request: Request) {
  try {
    assertLocalAiBridgeAvailable()
    getApiRequestContext(request)
    const { searchParams } = new URL(request.url)
    const capability = searchParams.get('capability') as AiCapability | null
    return NextResponse.json({ models: getAiModels(capability ?? undefined), ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI model registry failed.', models: [], ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}
