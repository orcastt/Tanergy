import { NextResponse } from 'next/server'
import type { BoardShareAccessRole } from '@/features/boards/boardTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const shareId = new URL(request.url).searchParams.get('shareId')
    if (!shareId) throw new Error('Missing shareId.')
    const shareLink = await getBoardStorageAdapter().resolveLocalBoardShareLink(shareId)
    return NextResponse.json({ ok: true, shareLink })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board share link resolve failed.', ok: false },
      { status: 400 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessRole?: BoardShareAccessRole; boardId?: string }
    if (!body.boardId) throw new Error('Missing boardId.')
    const shareLink = await getBoardStorageAdapter().ensureLocalBoardShareLink(
      body.boardId,
      body.accessRole ?? 'viewer',
      getApiRequestContext(request)
    )
    return NextResponse.json({ ok: true, shareLink })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board share link create failed.', ok: false },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { boardId?: string; shareId?: string }
    if (!body.boardId || !body.shareId) throw new Error('Missing boardId or shareId.')
    const revokedShareId = await getBoardStorageAdapter().revokeLocalBoardShareLink(
      body.boardId,
      body.shareId,
      getApiRequestContext(request)
    )
    return NextResponse.json({ ok: true, shareId: revokedShareId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board share link revoke failed.', ok: false },
      { status: 400 }
    )
  }
}
