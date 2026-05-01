import { NextResponse } from 'next/server'
import { getApiRequestContext } from '../../_lib/apiRequestContext'
import { getBoardStorageAdapter } from '../_lib/boardStorageAdapter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const boards = await getBoardStorageAdapter().listLocalBoards(getApiRequestContext(request))
    return NextResponse.json({ boards, ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Local board list failed.', ok: false },
      { status: 400 }
    )
  }
}
