import { NextResponse } from 'next/server'
import type { BoardCollaborationSessionUpsertInput } from '@/features/boards/boardCollaborationTypes'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { readJsonRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import {
  claimLocalBoardCollaborationSession,
  listLocalBoardCollaborationSessions,
} from '../_lib/localBoardCollaborationStore'

export const runtime = 'nodejs'

const maxBoardPresenceRequestBytes = 16 * 1024

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')
    if (!boardId) throw new Error('Missing board id.')
    const response = await listLocalBoardCollaborationSessions(boardId, getApiRequestContext(request))
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board presence failed to load.', ok: false },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const originRejection = rejectCrossSiteMutation(request)
    if (originRejection) return originRejection
    const body = await readJsonRequestWithLimit<BoardCollaborationSessionUpsertInput & { boardId?: string }>(request, maxBoardPresenceRequestBytes)
    if (!body.boardId) throw new Error('Missing board id.')
    if (!body.clientInstanceId) throw new Error('Missing client instance id.')
    const response = await claimLocalBoardCollaborationSession(
      body.boardId,
      {
        clientInstanceId: body.clientInstanceId,
        presence: body.presence,
        ttlSeconds: body.ttlSeconds,
      },
      getApiRequestContext(request),
    )
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Board presence failed to update.', ok: false },
      { status: requestBodyErrorStatus(error) },
    )
  }
}
