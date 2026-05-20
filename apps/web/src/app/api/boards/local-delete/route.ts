import { NextResponse } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

const maxBoardDeleteRequestBytes = 8 * 1024

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const body = await readJsonRequestWithLimit<{
      boardId?: string
    }>(request, maxBoardDeleteRequestBytes)
    if (!body.boardId) throw new Error('Missing boardId.')
    const boardId = await getBoardStorageAdapter().deleteLocalBoard(body.boardId, getApiRequestContext(request))
    return NextResponse.json({ boardId, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board delete failed.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}
