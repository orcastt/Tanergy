import { NextResponse } from 'next/server'
import type {
  BoardMemberCreateInput,
  BoardMemberInviteByEmailInput,
  BoardMemberUpdateInput,
} from '@/features/boards/boardTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const boardId = params.get('boardId')
    if (!boardId) throw new Error('Missing boardId.')
    const query = params.get('query')
    if (query !== null) {
      const candidates = await getBoardStorageAdapter().searchLocalBoardMemberCandidates(
        boardId,
        query,
        getApiRequestContext(request)
      )
      return NextResponse.json({ candidates, ok: true })
    }
    const members = await getBoardStorageAdapter().listLocalBoardMembers(boardId, getApiRequestContext(request))
    return NextResponse.json({ members, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board member request failed.', ok: false },
      { status: 400 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<BoardMemberCreateInput & BoardMemberInviteByEmailInput>
    if (!body.boardId || !body.role) throw new Error('Missing board member fields.')
    const member = 'email' in body && typeof body.email === 'string'
      ? await getBoardStorageAdapter().inviteLocalBoardMemberByEmail(
          body.boardId,
          body.email,
          body.role,
          body.displayName,
          getApiRequestContext(request)
        )
      : await getBoardStorageAdapter().upsertLocalBoardMember(
          body.boardId,
          body.userId ?? '',
          body.role,
          body.displayName,
          getApiRequestContext(request)
        )
    return NextResponse.json({ member, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board member create failed.', ok: false },
      { status: 400 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Partial<BoardMemberUpdateInput>
    if (!body.boardId || !body.userId) throw new Error('Missing board member fields.')
    const member = await getBoardStorageAdapter().upsertLocalBoardMember(
      body.boardId,
      body.userId,
      body.role ?? 'viewer',
      body.displayName,
      getApiRequestContext(request)
    )
    return NextResponse.json({ member, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board member update failed.', ok: false },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { boardId?: string; userId?: string }
    if (!body.boardId || !body.userId) throw new Error('Missing boardId or userId.')
    const userId = await getBoardStorageAdapter().removeLocalBoardMember(
      body.boardId,
      body.userId,
      getApiRequestContext(request)
    )
    return NextResponse.json({ ok: true, userId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board member remove failed.', ok: false },
      { status: 400 }
    )
  }
}
