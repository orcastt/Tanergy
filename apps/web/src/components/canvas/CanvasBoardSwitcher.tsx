'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { listLocalBoardDocuments } from '@/features/boards/localBoardClient'
import { CanvasBoardTitle } from './CanvasBoardTitle'

type CanvasBoardSwitcherProps = {
  boardId?: string
  onRename?: (title: string) => Promise<string | void> | string | void
  title: string
}

export function CanvasBoardSwitcher({ boardId, onRename, title }: CanvasBoardSwitcherProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recentBoards = useMemo(
    () => [...boards].sort(sortByRecentOpen).slice(0, 5),
    [boards]
  )

  const refreshBoards = useCallback(async () => {
    try {
      const response = await listLocalBoardDocuments()
      setBoards(response.boards)
      setError(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Recent boards failed.')
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBoards()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshBoards])

  useEffect(() => {
    if (!isOpen) return
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    return () => document.removeEventListener('pointerdown', closeOnPointerDown)
  }, [isOpen])

  const createBoard = () => {
    setIsOpen(false)
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  return (
    <div className="canvas-board-switcher" ref={rootRef}>
      <div className="canvas-board-switcher__control">
        <CanvasBoardTitle onRename={onRename} title={title} />
        <button
          aria-expanded={isOpen}
          aria-label="Switch board"
          className="canvas-board-switcher__chevron"
          onClick={() => {
            setIsOpen((open) => !open)
            if (!isOpen) void refreshBoards()
          }}
          type="button"
        >
          <span aria-hidden />
        </button>
      </div>
      <button aria-label="New board" className="canvas-board-switcher__new" onClick={createBoard} title="New board" type="button">
        +
      </button>

      {isOpen ? (
        <div className="canvas-board-switcher__menu" role="menu">
          <p>Recent boards</p>
          <div className="canvas-board-switcher__list">
            {error ? <span className="canvas-board-switcher__empty">{error}</span> : null}
            {!error && recentBoards.length === 0 ? <span className="canvas-board-switcher__empty">No recent boards yet.</span> : null}
            {recentBoards.map((board) => (
              <Link
                className="canvas-board-switcher__item"
                data-active={board.id === boardId ? 'true' : undefined}
                href={`/boards/${encodeURIComponent(board.id)}`}
                key={board.id}
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                <span>{board.title}</span>
                {board.id === boardId ? <i aria-hidden>✓</i> : null}
              </Link>
            ))}
          </div>
          <div className="canvas-board-switcher__footer">
            <Link href="/workspaces" onClick={() => setIsOpen(false)} role="menuitem">Open workspace</Link>
            <button onClick={createBoard} role="menuitem" type="button">New board</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function sortByRecentOpen(left: BoardPersistenceSummary, right: BoardPersistenceSummary) {
  return getRecentTime(right) - getRecentTime(left)
}

function getRecentTime(board: BoardPersistenceSummary) {
  return Date.parse(board.lastOpenedAt || board.savedAt) || 0
}

function createBoardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `board_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  }
  return `board_${Date.now().toString(36)}`
}
