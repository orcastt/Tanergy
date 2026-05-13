import { NextResponse } from 'next/server'
import { summarizeBoardRecord, type BoardCardColor } from '@/features/boards/boardTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

const maxBoardSaveRequestBytes = 3 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const body = await readJsonRequestWithLimit<{
      boardId?: string
      cardColor?: BoardCardColor | null
      description?: string | null
      document?: unknown
      thumbnailUrl?: string | null
      title?: string
    }>(request, maxBoardSaveRequestBytes)
    if (!Object.hasOwn(body, 'document')) throw new Error('Missing board document.')

    const { audit, board } = await getBoardStorageAdapter().saveLocalBoard({
      boardId: body.boardId,
      cardColor: body.cardColor,
      description: body.description,
      document: body.document,
      thumbnailUrl: body.thumbnailUrl,
      title: body.title,
    }, getApiRequestContext(request))

    if (!board) {
      return NextResponse.json({ audit, error: 'Board document failed save guard.', ok: false }, { status: 422 })
    }

    return NextResponse.json({ audit, board: summarizeBoardRecord(board), ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board save failed.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}
