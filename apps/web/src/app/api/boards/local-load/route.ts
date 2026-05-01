import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const boardId = new URL(request.url).searchParams.get('boardId')
    if (!boardId) throw new Error('Missing boardId.')
    const board = await getBoardStorageAdapter().loadLocalBoard(boardId, getApiRequestContext(request))
    return NextResponse.json({ board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board load failed.', ok: false },
      { status: 404 }
    )
  }
}
