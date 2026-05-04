import { NextResponse } from 'next/server'
import { isTangentAssetOrigin, type TangentAssetOrigin } from '@/features/assets/assetTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../_lib/assetStorageAdapter'
import { fetchRemoteImageForAsset } from '../_lib/remoteImageImport'

type AssetFromUrlRequest = {
  origin?: TangentAssetOrigin
  title?: string
  url?: string
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const input = await request.json() as AssetFromUrlRequest
    if (!input.url) throw new Error('Missing remote image URL.')
    const remote = await fetchRemoteImageForAsset(input.url)
    const record = await getAssetStorageAdapter().createFromUpload({
      bytes: remote.bytes,
      fileName: remote.fileName,
      height: remote.height,
      mime: remote.mime,
      origin: isTangentAssetOrigin(input.origin) ? input.origin : 'remote_import',
      title: input.title ?? 'Image',
      width: remote.width,
    }, getApiRequestContext(request))
    return NextResponse.json({ asset: record })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Remote image import failed.' },
      { status: 400 }
    )
  }
}
