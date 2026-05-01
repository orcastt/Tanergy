import { NextResponse } from 'next/server'
import { summarizeBoardRecord } from '@/features/boards/boardTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boardId?: string
      document?: unknown
      title?: string
    }
    if (!Object.hasOwn(body, 'document')) throw new Error('Missing board document.')

    const { audit, board } = await getBoardStorageAdapter().saveLocalBoard({
      boardId: body.boardId,
      document: body.document,
      title: body.title,
    }, getApiRequestContext(request))

    if (!board) {
      return NextResponse.json({ audit, error: 'Board document failed save guard.', ok: false }, { status: 422 })
    }

    return NextResponse.json({ audit, board: summarizeBoardRecord(board), ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board save failed.', ok: false },
      { status: 400 }
    )
  }
}
