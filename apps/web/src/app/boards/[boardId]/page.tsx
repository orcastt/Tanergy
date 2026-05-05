'use client'

import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import {
  detectBoardCanvasEngine,
  getDefaultBoardCanvasEngine,
  isTldrawReferenceEnabled,
  parseBoardCanvasEngine,
} from '@/features/boards/boardCanvasEngine'
import { loadLocalBoardDocument, renameLocalBoardDocument } from '@/features/boards/localBoardClient'

const CanvasSpike = dynamic(
  () => import('@/components/canvas/CanvasSpike').then((module) => module.CanvasSpike),
  {
    ssr: false,
  }
)
const KonvaCanvasSpike = dynamic(
  () => import('@/components/konva-canvas/KonvaCanvasSpike').then((module) => module.KonvaCanvasSpike),
  {
    ssr: false,
  }
)

type BoardLoadState =
  | { board: BoardPersistenceRecord; status: 'loaded' }
  | { error?: string; status: 'idle' | 'loading' | 'missing' }

export default function BoardCanvasPage() {
  const params = useParams<{ boardId?: string | string[] }>()
  const searchParams = useSearchParams()
  const rawBoardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId
  const boardId = rawBoardId ? decodeURIComponent(rawBoardId) : 'untitled-board'
  const isNewBoard = searchParams.get('new') === '1'
  const requestedEngine = parseBoardCanvasEngine(searchParams.get('engine'))
  const [loadState, setLoadState] = useState<BoardLoadState>({ status: isNewBoard ? 'idle' : 'loading' })
  const [boardTitleOverride, setBoardTitleOverride] = useState<{ boardId: string; title: string } | null>(null)
  const tldrawReferenceEnabled = isTldrawReferenceEnabled()
  const detectedEngine = loadState.status === 'loaded' ? detectBoardCanvasEngine(loadState.board.document) : null
  const engine = useMemo(
    () => detectedEngine ?? requestedEngine ?? getDefaultBoardCanvasEngine(),
    [detectedEngine, requestedEngine]
  )
  const boardTitle = boardTitleOverride?.boardId === boardId
    ? boardTitleOverride.title
    : loadState.status === 'loaded'
      ? loadState.board.title
      : formatBoardTitle(boardId)

  useEffect(() => {
    let cancelled = false
    const loadBoard = async () => {
      if (isNewBoard) {
        if (!cancelled) setLoadState({ status: 'idle' })
        return
      }
      if (!cancelled) setLoadState({ status: 'loading' })
      try {
        const response = await loadLocalBoardDocument(boardId)
        if (cancelled) return
        setLoadState(response.board ? { board: response.board, status: 'loaded' } : { status: 'missing' })
      } catch (error) {
        if (!cancelled) setLoadState({ error: error instanceof Error ? error.message : 'Board load failed.', status: 'missing' })
      }
    }
    void loadBoard()
    return () => {
      cancelled = true
    }
  }, [boardId, isNewBoard])

  const renameBoardTitle = useCallback(async (title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return boardTitle
    try {
      const response = await renameLocalBoardDocument(boardId, nextTitle)
      const renamedTitle = response.board?.title ?? nextTitle
      setBoardTitleOverride({ boardId, title: renamedTitle })
      return renamedTitle
    } catch (error) {
      if (!isNewBoard && loadState.status !== 'missing') throw error
      setBoardTitleOverride({ boardId, title: nextTitle })
      return nextTitle
    }
  }, [boardId, boardTitle, isNewBoard, loadState.status])

  if (loadState.status === 'loading') {
    return <BoardRouteState title="Loading Board" detail={formatBoardTitle(boardId)} />
  }

  if (loadState.status === 'loaded' && !detectedEngine) {
    return (
      <BoardRouteState
        title="Unsupported Board Document"
        detail="This saved Board is not a tldraw v1 or Konva v2 document, so it was not opened automatically."
      />
    )
  }

  if (detectedEngine === 'tldraw' && !tldrawReferenceEnabled) {
    return (
      <BoardRouteState
        title="tldraw Reference Disabled"
        detail="This saved Board is a legacy tldraw v1 document. Production Boards must be opened through Konva v2."
      />
    )
  }

  if (engine === 'konva') {
    return (
      <KonvaCanvasSpike
        autoLoadBoard={loadState.status === 'loaded' && detectedEngine === 'konva'}
        boardId={boardId}
        boardTitle={boardTitle}
        mode="board"
        onBoardLoaded={(title) => setBoardTitleOverride({ boardId, title })}
        onBoardTitleRename={renameBoardTitle}
        seedOnMount={false}
      />
    )
  }

  if (!tldrawReferenceEnabled) {
    return (
      <BoardRouteState
        title="tldraw Reference Disabled"
        detail="tldraw is only available as a development reference route, not as a production Board engine."
      />
    )
  }

  return (
    <CanvasSpike
      autoLoadBoard={loadState.status === 'loaded' && detectedEngine === 'tldraw'}
      boardId={boardId}
      boardTitle={boardTitle}
      headerTitle={boardTitle}
      onBoardLoaded={(title) => setBoardTitleOverride({ boardId, title })}
      onBoardTitleRename={renameBoardTitle}
      seedOnMount={false}
    />
  )
}

function BoardRouteState({ detail, title }: { detail: string; title: string }) {
  return (
    <main className="canvas-board-route-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </main>
  )
}

function formatBoardTitle(boardId: string) {
  return boardId
    .replace(/^board[_-]?/i, '')
    .replace(/[._-]+/g, ' ')
    .trim() || 'Untitled board'
}
