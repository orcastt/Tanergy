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
    const copied = await getBoardStorageAdapter().copyLocalBoard(body.boardId, getApiRequestContext(request))
    if (!copied.board) throw new Error(copied.audit.issues[0]?.message ?? 'Local board copy failed.')
    return NextResponse.json({ board: copied.board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board copy failed.', ok: false },
      { status: 400 }
    )
  }
}
