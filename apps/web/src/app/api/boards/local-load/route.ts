import { NextResponse } from 'next/server'
import { loadLocalBoard } from '../_lib/localBoardStore'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const boardId = new URL(request.url).searchParams.get('boardId')
    if (!boardId) throw new Error('Missing boardId.')
    const board = await loadLocalBoard(boardId)
    return NextResponse.json({ board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board load failed.', ok: false },
      { status: 404 }
    )
  }
}
