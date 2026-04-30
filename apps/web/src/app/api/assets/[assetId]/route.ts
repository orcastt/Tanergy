import { NextResponse } from 'next/server'
import { getLocalAssetRecord } from '../_lib/localAssetStore'

export const runtime = 'nodejs'

type AssetRouteContext = {
  params: Promise<{ assetId: string }>
}

export async function GET(_request: Request, context: AssetRouteContext) {
  try {
    const { assetId } = await context.params
    const asset = await getLocalAssetRecord(assetId)
    return NextResponse.json({ asset })
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
  }
}
