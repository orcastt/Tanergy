import { NextResponse } from 'next/server'
import { createLocalAssetFromDataUrl } from '../_lib/localAssetStore'
import type { TangentAssetDataUrlInput } from '@/features/assets/assetTypes'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const input = await request.json() as TangentAssetDataUrlInput
    const record = await createLocalAssetFromDataUrl(input)
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset upload failed.' },
      { status: 400 }
    )
  }
}
