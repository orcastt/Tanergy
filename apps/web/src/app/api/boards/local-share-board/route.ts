import { NextResponse } from 'next/server'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'
import { getLocalBoardShareErrorStatus } from '../_lib/localBoardSharePassword'

export const runtime = 'nodejs'
const publicShareHeaders = {
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
}

export async function GET(request: Request) {
  try {
    const shareId = new URL(request.url).searchParams.get('shareId')
    if (!shareId) throw new Error('Missing shareId.')
    const board = await getBoardStorageAdapter().loadLocalSharedBoard(
      shareId,
      request.headers.get('x-tangent-share-password'),
    )
    return NextResponse.json({ board, ok: true }, { headers: publicShareHeaders })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Shared board load failed.', ok: false },
      { headers: publicShareHeaders, status: getLocalBoardShareErrorStatus(error, 404) }
    )
  }
}
