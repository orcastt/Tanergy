'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import { listLocalBoardDocuments } from '@/features/boards/localBoardClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

const boardIdPattern = /^[a-zA-Z0-9._-]+$/

export function BoardDashboard() {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [openBoardId, setOpenBoardId] = useState('')
  const persistenceLabel = useMemo(
    () => hasRemotePersistenceApi() ? 'FastAPI persistence' : 'Local bridge',
    []
  )

  const refreshBoards = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listLocalBoardDocuments()
      setBoards(response.boards)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board list failed.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBoards()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshBoards])

  const createBoard = () => {
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  const openBoard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const boardId = openBoardId.trim()
    if (!boardIdPattern.test(boardId) || boardId.includes('..')) {
      setError('Enter a valid board id.')
      return
    }
    router.push(`/boards/${encodeURIComponent(boardId)}`)
  }

  return (
    <main className="boards-shell">
      <header className="boards-topbar">
        <div>
          <p className="eyebrow">TANGENT P0</p>
          <h1>Boards</h1>
        </div>
        <div className="boards-status">
          <span>{persistenceLabel}</span>
        </div>
      </header>

      <section className="boards-content">
        <div className="boards-actions">
          <button className="boards-primary-button" onClick={createBoard} type="button">
            New board
          </button>
          <form className="boards-open-form" onSubmit={openBoard}>
            <input
              aria-label="Board id"
              onChange={(event) => setOpenBoardId(event.target.value)}
              placeholder="Board id"
              spellCheck={false}
              value={openBoardId}
            />
            <button type="submit">Open</button>
          </form>
          <button className="boards-secondary-button" disabled={isLoading} onClick={() => void refreshBoards()} type="button">
            Refresh
          </button>
        </div>

        {error ? <p className="boards-error">{error}</p> : null}

        <section className="boards-table" aria-label="Recent boards">
          <div className="boards-table-head">
            <span>Board</span>
            <span>Saved</span>
            <span>Size</span>
          </div>
          {isLoading ? <div className="boards-empty">Loading boards</div> : null}
          {!isLoading && boards.length === 0 ? <div className="boards-empty">No saved boards yet</div> : null}
          {!isLoading && boards.map((board) => (
            <Link className="boards-row" href={`/boards/${encodeURIComponent(board.id)}`} key={board.id}>
              <span>
                <strong>{board.title}</strong>
                <small>{board.id}</small>
              </span>
              <time dateTime={board.savedAt}>{formatSavedAt(board.savedAt)}</time>
              <span>{formatBytes(board.byteSize)}</span>
            </Link>
          ))}
        </section>
      </section>
    </main>
  )
}

function createBoardId() {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `board_${randomId}`
}

function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
