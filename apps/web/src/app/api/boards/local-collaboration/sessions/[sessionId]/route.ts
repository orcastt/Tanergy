import { NextResponse } from 'next/server'
import { rejectCrossSiteMutation } from '../../../../_lib/csrfGuard'
import { getApiRequestContext } from '../../../../_lib/apiRequestContext'
import { releaseLocalBoardCollaborationSession } from '../../../_lib/localBoardCollaborationStore'

export const runtime = 'nodejs'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')
    const { sessionId } = await params
    if (!boardId) throw new Error('Missing board id.')
    const response = await releaseLocalBoardCollaborationSession(
      boardId,
      sessionId,
      getApiRequestContext(request),
    )
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board presence failed to close.', ok: false },
      { status: 400 },
    )
  }
}
