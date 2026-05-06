import { NextResponse } from 'next/server'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const shareId = new URL(request.url).searchParams.get('shareId')
    if (!shareId) throw new Error('Missing shareId.')
    const board = await getBoardStorageAdapter().loadLocalSharedBoard(shareId)
    return NextResponse.json({ board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Shared board load failed.', ok: false },
      { status: 404 }
    )
  }
}
