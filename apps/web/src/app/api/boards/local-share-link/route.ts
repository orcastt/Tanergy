import { NextResponse } from 'next/server'
import type { BoardShareAccessRole } from '@/features/boards/boardTypes'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'
import { getLocalBoardShareErrorStatus } from '../_lib/localBoardSharePassword'

export const runtime = 'nodejs'

const maxBoardShareLinkRequestBytes = 8 * 1024
const publicShareHeaders = {
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
}

export async function GET(request: Request) {
  try {
    const shareId = new URL(request.url).searchParams.get('shareId')
    if (!shareId) throw new Error('Missing shareId.')
    const shareLink = await getBoardStorageAdapter().resolveLocalBoardShareLink(
      shareId,
      request.headers.get('x-tangent-share-password'),
    )
    return NextResponse.json({ ok: true, shareLink }, { headers: publicShareHeaders })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board share link resolve failed.', ok: false },
      { headers: publicShareHeaders, status: getLocalBoardShareErrorStatus(error, 400) }
    )
  }
}

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const body = await readJsonRequestWithLimit<{
      accessRole?: BoardShareAccessRole
      boardId?: string
      clearPassword?: boolean
      expiresAt?: string | null
      password?: string | null
      regenerate?: boolean
    }>(request, maxBoardShareLinkRequestBytes)
    if (!body.boardId) throw new Error('Missing boardId.')
    const shareLink = await getBoardStorageAdapter().ensureLocalBoardShareLink(
      body.boardId,
      body.accessRole ?? 'viewer',
      getApiRequestContext(request),
      body.expiresAt,
      body.password,
      body.clearPassword ?? false,
      body.regenerate ?? false,
    )
    return NextResponse.json({ ok: true, shareLink })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board share link create failed.', ok: false },
      { status: requestBodyErrorStatus(error) }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const body = await readJsonRequestWithLimit<{ boardId?: string; shareId?: string }>(request, maxBoardShareLinkRequestBytes)
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
      { status: requestBodyErrorStatus(error) }
    )
  }
}
