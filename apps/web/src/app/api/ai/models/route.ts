import { NextResponse } from 'next/server'
import { getAiModels } from '@/features/ai/mockAiContracts'
import type { AiCapability } from '@/features/ai/aiTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'

export const runtime = 'nodejs'

export function GET(request: Request) {
  try {
    assertLocalAiModelsAllowed()
    getApiRequestContext(request)
    const { searchParams } = new URL(request.url)
    const capability = searchParams.get('capability') as AiCapability | null
    return NextResponse.json({ models: getAiModels(capability ?? undefined), ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI model registry failed.', models: [], ok: false },
      { status: 400 }
    )
  }
}

function assertLocalAiModelsAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.TANGENT_ENABLE_LOCAL_AI_ROUTES !== '1') {
    throw new Error('Local AI model registry is disabled in production. Use the backend AiRun API.')
  }
}
