import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boardId?: string
    }
    if (!body.boardId) throw new Error('Missing boardId.')
    const boardId = await getBoardStorageAdapter().deleteLocalBoard(body.boardId, getApiRequestContext(request))
    return NextResponse.json({ boardId, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board delete failed.', ok: false },
      { status: 400 }
    )
  }
}
