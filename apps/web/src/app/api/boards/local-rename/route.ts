import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boardId?: string
      title?: string
    }
    if (!body.boardId) throw new Error('Missing boardId.')
    const board = await getBoardStorageAdapter().renameLocalBoard(
      body.boardId,
      body.title ?? '',
      getApiRequestContext(request)
    )
    return NextResponse.json({ board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board rename failed.', ok: false },
      { status: 400 }
    )
  }
}
