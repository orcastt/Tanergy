import { NextResponse } from 'next/server'
import { assertLocalAssetBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

type AssetRouteContext = {
  params: Promise<{ assetId: string }>
}

export async function GET(request: Request, context: AssetRouteContext) {
  try {
    assertLocalAssetBridgeAvailable()
    const { assetId } = await context.params
    const asset = await getAssetStorageAdapter().getRecord(assetId, getApiRequestContext(request))
    return NextResponse.json({ asset })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset not found.' },
      { status: error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 404 }
    )
  }
}
