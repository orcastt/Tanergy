'use client'

import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'

const CanvasSpike = dynamic(
  () => import('@/components/canvas/CanvasSpike').then((module) => module.CanvasSpike),
  {
    ssr: false,
  }
)

export default function BoardCanvasPage() {
  const params = useParams<{ boardId?: string | string[] }>()
  const searchParams = useSearchParams()
  const rawBoardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId
  const boardId = rawBoardId ? decodeURIComponent(rawBoardId) : 'untitled-board'
  const isNewBoard = searchParams.get('new') === '1'

  return (
    <CanvasSpike
      autoLoadBoard={!isNewBoard}
      boardId={boardId}
      boardTitle={formatBoardTitle(boardId)}
      checklistItems={['Asset-backed', 'Save guard', 'FastAPI-ready']}
      headerEyebrow="TANGENT Board"
      headerTitle={formatBoardTitle(boardId)}
      seedOnMount={false}
    />
  )
}

function formatBoardTitle(boardId: string) {
  return boardId
    .replace(/^board[_-]?/i, '')
    .replace(/[._-]+/g, ' ')
    .trim() || 'Untitled board'
}
