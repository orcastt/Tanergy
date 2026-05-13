import { NextResponse } from 'next/server'
import type { TangentAssetDataUrlInput } from '@/features/assets/assetTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

const maxDataUrlAssetRequestBytes = 32 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const input = await readJsonRequestWithLimit<TangentAssetDataUrlInput>(request, maxDataUrlAssetRequestBytes)
    const record = await getAssetStorageAdapter().createFromDataUrl(input, getApiRequestContext(request))
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset upload failed.' },
      { status: requestBodyErrorStatus(error) }
    )
  }
}
