'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import {
  deleteLocalBoardDocument,
  listLocalBoardDocuments,
  renameLocalBoardDocument,
} from '@/features/boards/localBoardClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { normalizeUserLabelInput } from '@/features/security/safeText'
import { BoardDashboardRow } from './BoardDashboardRow'

const boardIdPattern = /^[a-zA-Z0-9._-]+$/
const boardListLimit = 20
const boardTitleOpenDelayMs = 180

export function BoardDashboard() {
  const router = useRouter()
  const openBoardClickTimer = useRef<number | null>(null)
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
  const filteredBoards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return query ? boards.filter((board) => (
      board.title.toLowerCase().includes(query) || board.id.toLowerCase().includes(query)
    )) : boards
  }, [boards, searchQuery])
  const visibleBoards = useMemo(() => {
    return filteredBoards.slice(0, boardListLimit)
  }, [filteredBoards])
  const hiddenBoardCount = Math.max(filteredBoards.length - visibleBoards.length, 0)

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

  const clearOpenBoardClickTimer = useCallback(() => {
    if (openBoardClickTimer.current === null) return
    window.clearTimeout(openBoardClickTimer.current)
    openBoardClickTimer.current = null
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBoards()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshBoards])

  useEffect(() => clearOpenBoardClickTimer, [clearOpenBoardClickTimer])

  const createBoard = () => {
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  const startRename = (board: BoardPersistenceSummary) => {
    setEditingBoardId(board.id)
    setEditingTitle(board.title)
    setError(null)
  }

  const openBoardFromTitle = (board: BoardPersistenceSummary) => {
    clearOpenBoardClickTimer()
    openBoardClickTimer.current = window.setTimeout(() => {
      router.push(`/boards/${encodeURIComponent(board.id)}`)
    }, boardTitleOpenDelayMs)
  }

  const renameBoardFromTitle = (board: BoardPersistenceSummary) => {
    clearOpenBoardClickTimer()
    startRename(board)
  }

  const cancelRename = () => {
    setEditingBoardId(null)
    setEditingTitle('')
  }

  const renameBoard = async (event: FormEvent<HTMLFormElement>, boardId: string) => {
    event.preventDefault()
    const title = normalizeUserLabelInput(editingTitle)
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
          <p className="product-kicker">Tanergy P0</p>
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

        {error ? (
          <div className="boards-error" role="alert">
            <span>{error}</span>
            <button onClick={() => void refreshBoards()} type="button">Retry</button>
          </div>
        ) : null}

        <section className="boards-table" aria-label="Recent boards">
          <div className="boards-table-head">
            <span>Board</span>
            <span>Objects</span>
            <span>Saved</span>
            <span>Size</span>
            <span>Actions</span>
          </div>
          {isLoading ? <BoardLoadingState /> : null}
          {!isLoading && boards.length === 0 ? (
            <BoardEmptyState onCreate={createBoard} />
          ) : null}
          {!isLoading && boards.length > 0 && visibleBoards.length === 0 ? (
            <div className="boards-empty">No boards match your search.</div>
          ) : null}
          {!isLoading && visibleBoards.map((board) => (
            <BoardDashboardRow
              board={board}
              editingTitle={editingTitle}
              isEditing={editingBoardId === board.id}
              isPending={pendingBoardId === board.id}
              key={board.id}
              onCancelRename={cancelRename}
              onDelete={(item) => void deleteBoard(item)}
              onOpenTitle={openBoardFromTitle}
              onRenameTitle={renameBoardFromTitle}
              onStartRename={startRename}
              onSubmitRename={(event, boardId) => void renameBoard(event, boardId)}
              onTitleChange={setEditingTitle}
            />
          ))}
        </section>
        {!isLoading && hiddenBoardCount > 0 ? (
          <p className="boards-list-note">Showing the latest {visibleBoards.length} boards. Use search to narrow the list.</p>
        ) : null}
      </section>
    </section>
  )
}

function BoardLoadingState() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div className="boards-row boards-row-skeleton" key={item}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </>
  )
}

function BoardEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="boards-empty boards-empty-hero">
      <strong>No saved boards yet.</strong>
      <span>Create your first local board, then return here to reopen it.</span>
      <button className="boards-primary-button" onClick={onCreate} type="button">New board</button>
    </div>
  )
}

function createBoardId() {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `board_${randomId}`
}
