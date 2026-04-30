import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../../_lib/assetStorageAdapter'

export const runtime = 'nodejs'

type AssetFileRouteContext = {
  params: Promise<{ assetId: string; fileName: string }>
}

export async function GET(request: Request, context: AssetFileRouteContext) {
  try {
    const { assetId, fileName } = await context.params
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, getApiRequestContext(request))
    return new NextResponse(file, {
      headers: {
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Type': mime,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Asset file not found.' }, { status: 404 })
  }
}
