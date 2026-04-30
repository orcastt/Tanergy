import { NextResponse } from 'next/server'
import { saveLocalBoard } from '../_lib/localBoardStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boardId?: string
      document?: unknown
      title?: string
    }
    if (!Object.hasOwn(body, 'document')) throw new Error('Missing board document.')

    const { audit, board } = await saveLocalBoard({
      boardId: body.boardId,
      document: body.document,
      title: body.title,
    })

    if (!board) {
      return NextResponse.json({ audit, error: 'Board document failed save guard.', ok: false }, { status: 422 })
    }

    return NextResponse.json({ audit, board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board save failed.', ok: false },
      { status: 400 }
    )
  }
}
