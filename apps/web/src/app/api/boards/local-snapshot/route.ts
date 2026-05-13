import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

const maxBoardSnapshotRequestBytes = 3 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const body = await readJsonRequestWithLimit<{
      boardId?: string
      document?: unknown
      reason?: string
      thumbnailUrl?: string | null
      title?: string
    }>(request, maxBoardSnapshotRequestBytes)
    if (!body.boardId) throw new Error('Missing boardId.')
    if (!Object.hasOwn(body, 'document')) throw new Error('Missing board document.')
    const reason = body.reason === 'autosave' ||
      body.reason === 'keyboard' ||
      body.reason === 'auto_interval' ||
      body.reason === 'manual_save' ||
      body.reason === 'pre_restore'
      ? body.reason
      : 'manual'
    const snapshot = await getBoardStorageAdapter().createLocalBoardSnapshot({
      boardId: body.boardId,
      document: body.document,
      reason,
      thumbnailUrl: body.thumbnailUrl,
      title: body.title,
    }, getApiRequestContext(request))
    return NextResponse.json({ ok: true, snapshot })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board history failed.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const boardId = params.get('boardId')
    const snapshotId = params.get('snapshotId')
    if (!boardId || !snapshotId) throw new Error('Missing boardId or snapshotId.')
    const snapshot = await getBoardStorageAdapter().loadLocalBoardSnapshot(boardId, snapshotId, getApiRequestContext(request))
    return NextResponse.json({ ok: true, snapshot })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board history load failed.', ok: false },
      { status: 404 }
    )
  }
}
