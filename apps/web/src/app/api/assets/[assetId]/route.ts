import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

type AssetRouteContext = {
  params: Promise<{ assetId: string }>
}

export async function GET(request: Request, context: AssetRouteContext) {
  try {
    const { assetId } = await context.params
    const asset = await getAssetStorageAdapter().getRecord(assetId, getApiRequestContext(request))
    return NextResponse.json({ asset })
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
  }
}
