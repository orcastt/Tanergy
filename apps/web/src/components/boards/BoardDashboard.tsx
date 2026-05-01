'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import {
  deleteLocalBoardDocument,
  listLocalBoardDocuments,
  renameLocalBoardDocument,
} from '@/features/boards/localBoardClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

const boardIdPattern = /^[a-zA-Z0-9._-]+$/

export function BoardDashboard() {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [openBoardId, setOpenBoardId] = useState('')
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const persistenceLabel = useMemo(
    () => hasRemotePersistenceApi() ? 'FastAPI persistence' : 'Local bridge',
    []
  )
  const visibleBoards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return boards
    return boards.filter((board) => (
      board.title.toLowerCase().includes(query) || board.id.toLowerCase().includes(query)
    ))
  }, [boards, searchQuery])

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

  const startRename = (board: BoardPersistenceSummary) => {
    setEditingBoardId(board.id)
    setEditingTitle(board.title)
    setError(null)
  }

  const cancelRename = () => {
    setEditingBoardId(null)
    setEditingTitle('')
  }

  const renameBoard = async (event: FormEvent<HTMLFormElement>, boardId: string) => {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) {
      setError('Board title is required.')
      return
    }
    if (title.length > 80) {
      setError('Board title must be 80 characters or fewer.')
      return
    }
    setPendingBoardId(boardId)
    setError(null)
    try {
      const response = await renameLocalBoardDocument(boardId, title)
      const renamedBoard = response.board
      if (!renamedBoard) throw new Error('Board rename failed.')
      setBoards((current) => current.map((board) => board.id === boardId ? renamedBoard : board))
      cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board rename failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const deleteBoard = async (board: BoardPersistenceSummary) => {
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return
    setPendingBoardId(board.id)
    setError(null)
    try {
      await deleteLocalBoardDocument(board.id)
      setBoards((current) => current.filter((item) => item.id !== board.id))
      if (editingBoardId === board.id) cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board delete failed.')
    } finally {
      setPendingBoardId(null)
    }
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
    <section className="boards-shell">
      <header className="boards-topbar">
        <div>
          <p className="product-kicker">TANGENT P0</p>
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
          <input
            aria-label="Search boards"
            className="boards-search-input"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search boards"
            value={searchQuery}
          />
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
            <span>Actions</span>
          </div>
          {isLoading ? <div className="boards-empty">Loading boards</div> : null}
          {!isLoading && boards.length === 0 ? <div className="boards-empty">No saved boards yet</div> : null}
          {!isLoading && boards.length > 0 && visibleBoards.length === 0 ? <div className="boards-empty">No boards match your search</div> : null}
          {!isLoading && visibleBoards.map((board) => (
            <div className="boards-row" key={board.id}>
              {editingBoardId === board.id ? (
                <form className="boards-rename-form" onSubmit={(event) => void renameBoard(event, board.id)}>
                  <input
                    aria-label="Board title"
                    maxLength={80}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    value={editingTitle}
                  />
                  <button disabled={pendingBoardId === board.id} type="submit">Save</button>
                  <button disabled={pendingBoardId === board.id} onClick={cancelRename} type="button">Cancel</button>
                </form>
              ) : (
                <Link className="boards-title-link" href={`/boards/${encodeURIComponent(board.id)}`}>
                  <strong>{board.title}</strong>
                  <small>{board.id}</small>
                </Link>
              )}
              <time dateTime={board.savedAt}>{formatSavedAt(board.savedAt)}</time>
              <span>{formatBytes(board.byteSize)}</span>
              <span className="boards-row-actions">
                <Link href={`/boards/${encodeURIComponent(board.id)}`}>Open</Link>
                <button disabled={pendingBoardId === board.id} onClick={() => startRename(board)} type="button">
                  Rename
                </button>
                <button disabled={pendingBoardId === board.id} onClick={() => void deleteBoard(board)} type="button">
                  Delete
                </button>
              </span>
            </div>
          ))}
        </section>
      </section>
    </section>
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
