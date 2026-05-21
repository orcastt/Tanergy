import { NextResponse } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const boardId = new URL(request.url).searchParams.get('boardId')
    if (!boardId) throw new Error('Missing boardId.')
    const snapshots = await getBoardStorageAdapter().listLocalBoardSnapshots(boardId, getApiRequestContext(request))
    return NextResponse.json({ ok: true, snapshots })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board history list failed.', ok: false, snapshots: [] },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const boardId = new URL(request.url).searchParams.get('boardId')
    if (!boardId) throw new Error('Missing boardId.')
    const deletedCount = await getBoardStorageAdapter().clearLocalBoardSnapshots(boardId, getApiRequestContext(request))
    return NextResponse.json({ deletedCount, ok: true })
  } catch (error) {
    return NextResponse.json(
      { deletedCount: 0, error: error instanceof Error ? error.message : 'Board history clear failed.', ok: false },
      { status: 400 }
    )
  }
}
