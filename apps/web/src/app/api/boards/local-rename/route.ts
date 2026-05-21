import { NextResponse } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

const maxBoardRenameRequestBytes = 8 * 1024

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const body = await readJsonRequestWithLimit<{
      boardId?: string
      title?: string
    }>(request, maxBoardRenameRequestBytes)
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
      { status: requestBodyErrorStatus(error) }
    )
  }
}
