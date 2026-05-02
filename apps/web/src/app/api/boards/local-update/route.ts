import { NextResponse } from 'next/server'
import type { BoardCardColor, BoardMetadataUpdateInput, BoardVisibility } from '@/features/boards/boardTypes'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boardId?: string
      cardColor?: BoardCardColor | null
      description?: string | null
      isPinned?: boolean
      isStarred?: boolean
      shareId?: string | null
      thumbnailUrl?: string | null
      title?: string
      visibility?: BoardVisibility
    }
    if (!body.boardId) throw new Error('Missing boardId.')
    const input: BoardMetadataUpdateInput = { boardId: body.boardId }
    if (Object.hasOwn(body, 'cardColor')) input.cardColor = body.cardColor
    if (Object.hasOwn(body, 'description')) input.description = body.description
    if (Object.hasOwn(body, 'isPinned')) input.isPinned = body.isPinned
    if (Object.hasOwn(body, 'isStarred')) input.isStarred = body.isStarred
    if (Object.hasOwn(body, 'shareId')) input.shareId = body.shareId
    if (Object.hasOwn(body, 'thumbnailUrl')) input.thumbnailUrl = body.thumbnailUrl
    if (Object.hasOwn(body, 'title')) input.title = body.title
    if (Object.hasOwn(body, 'visibility')) input.visibility = body.visibility
    const board = await getBoardStorageAdapter().updateLocalBoardMetadata(input, getApiRequestContext(request))
    return NextResponse.json({ board, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board update failed.', ok: false },
      { status: 400 }
    )
  }
}
