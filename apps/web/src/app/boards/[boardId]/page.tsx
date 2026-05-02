'use client'

import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { renameLocalBoardDocument } from '@/features/boards/localBoardClient'

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
  const [boardTitleOverride, setBoardTitleOverride] = useState<{ boardId: string; title: string } | null>(null)
  const boardTitle = boardTitleOverride?.boardId === boardId ? boardTitleOverride.title : formatBoardTitle(boardId)

  const renameBoardTitle = useCallback(async (title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return boardTitle
    try {
      const response = await renameLocalBoardDocument(boardId, nextTitle)
      const renamedTitle = response.board?.title ?? nextTitle
      setBoardTitleOverride({ boardId, title: renamedTitle })
      return renamedTitle
    } catch (error) {
      if (!isNewBoard) throw error
      setBoardTitleOverride({ boardId, title: nextTitle })
      return nextTitle
    }
  }, [boardId, boardTitle, isNewBoard])

  return (
    <CanvasSpike
      autoLoadBoard={!isNewBoard}
      boardId={boardId}
      boardTitle={boardTitle}
      headerTitle={boardTitle}
      onBoardLoaded={(title) => setBoardTitleOverride({ boardId, title })}
      onBoardTitleRename={renameBoardTitle}
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
