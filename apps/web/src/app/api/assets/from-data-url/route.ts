import { NextResponse } from 'next/server'
import type { TangentAssetDataUrlInput } from '@/features/assets/assetTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const input = await request.json() as TangentAssetDataUrlInput
    const record = await getAssetStorageAdapter().createFromDataUrl(input, getApiRequestContext(request))
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset upload failed.' },
      { status: 400 }
    )
  }
}
