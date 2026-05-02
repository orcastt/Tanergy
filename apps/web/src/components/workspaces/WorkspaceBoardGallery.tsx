'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { BoardPersistenceSummary, SerializedBoardSaveInput } from '@/features/boards/boardTypes'
import {
  deleteLocalBoardDocument,
  listLocalBoardDocuments,
  loadLocalBoardDocument,
  renameLocalBoardDocument,
  saveLocalBoardDocument,
} from '@/features/boards/localBoardClient'
import { WorkspaceBoardItem, type WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { NewBoardTile, WorkspaceEmptyState, WorkspaceLoadingState } from './WorkspaceBoardStates'
import { WorkspaceBoardToolbar, type WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'

type ViewMode = WorkspaceBoardViewMode
type SortMode = WorkspaceBoardSortMode

const boardPageSize = 12

export function WorkspaceBoardGallery() {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('opened')
  const [visibleLimit, setVisibleLimit] = useState(boardPageSize)
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')

  const filteredBoards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const visibleBoards = query ? boards.filter((board) => (
      board.title.toLowerCase().includes(query) || board.id.toLowerCase().includes(query)
    )) : boards

    return [...visibleBoards].sort((left, right) => {
      if (sortMode === 'title') return left.title.localeCompare(right.title)
      if (sortMode === 'objects') return getBoardObjectTotal(right) - getBoardObjectTotal(left)
      if (sortMode === 'saved') return getSavedTime(right) - getSavedTime(left)
      return getActivityTime(right) - getActivityTime(left)
    })
  }, [boards, searchQuery, sortMode])

  const visibleBoards = useMemo(() => filteredBoards.slice(0, visibleLimit), [filteredBoards, visibleLimit])
  const hasMoreBoards = filteredBoards.length > visibleBoards.length

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

  const openBoard = (boardId: string) => {
    router.push(`/boards/${encodeURIComponent(boardId)}`)
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
    setPendingBoardId(boardId)
    setError(null)
    try {
      const response = await renameLocalBoardDocument(boardId, title)
      if (!response.board) throw new Error('Board rename failed.')
      setBoards((current) => current.map((board) => board.id === boardId ? response.board! : board))
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

  const copyBoard = async (board: BoardPersistenceSummary) => {
    setPendingBoardId(board.id)
    setError(null)
    try {
      const source = await loadLocalBoardDocument(board.id)
      const response = await saveLocalBoardDocument({
        boardId: createBoardId(),
        document: source.board!.document as SerializedBoardSaveInput['document'],
        title: `${board.title} copy`,
      })
      if (!response.board) throw new Error('Board copy failed.')
      setBoards((current) => [response.board!, ...current])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const updateSearchQuery = (query: string) => {
    setSearchQuery(query)
    setVisibleLimit(boardPageSize)
  }

  const updateSortMode = (mode: SortMode) => {
    setSortMode(mode)
    setVisibleLimit(boardPageSize)
  }

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    setVisibleLimit(boardPageSize)
  }

  return (
    <div className="workspace-page">
      <section className="workspace-header">
        <div>
          <p className="product-kicker">Workspace</p>
          <h1>Boards in this workspace.</h1>
          <p>Open a saved canvas, create a new board, or switch between gallery and list scanning.</p>
        </div>
        <div className="workspace-header-actions" aria-label="Workspace board controls">
          <button className="product-button product-button-primary" onClick={createBoard} type="button">
            New board
          </button>
          <button className="product-button product-button-secondary" disabled={isLoading} onClick={() => void refreshBoards()} type="button">
            Refresh
          </button>
        </div>
      </section>

      <WorkspaceBoardToolbar
        onSearchChange={updateSearchQuery}
        onSortModeChange={updateSortMode}
        onViewModeChange={updateViewMode}
        searchQuery={searchQuery}
        sortMode={sortMode}
        viewMode={viewMode}
      />

      {error ? <div className="workspace-error" role="alert">{error}</div> : null}
      {isLoading ? <WorkspaceLoadingState /> : null}
      {!isLoading && boards.length === 0 ? <WorkspaceEmptyState onCreate={createBoard} /> : null}
      {!isLoading && boards.length > 0 && filteredBoards.length === 0 ? (
        <div className="workspace-empty-inline">No boards match your search.</div>
      ) : null}
      {!isLoading && filteredBoards.length > 0 ? (
        <section className={viewMode === 'gallery' ? 'workspace-board-grid' : 'workspace-board-list'} aria-label="Workspace boards">
          <NewBoardTile onCreate={createBoard} viewMode={viewMode} />
          {visibleBoards.map((board) => (
            <WorkspaceBoardItem
              board={board}
              editingTitle={editingTitle}
              isEditing={editingBoardId === board.id}
              isPending={pendingBoardId === board.id}
              key={board.id}
              onCancelRename={cancelRename}
              onCopy={() => void copyBoard(board)}
              onDelete={() => void deleteBoard(board)}
              onOpen={() => openBoard(board.id)}
              onRename={() => startRename(board)}
              onSubmitRename={(event) => void renameBoard(event, board.id)}
              onTitleChange={setEditingTitle}
              viewMode={viewMode}
            />
          ))}
        </section>
      ) : null}
      {!isLoading && filteredBoards.length > 0 ? (
        <div className="workspace-pagination" aria-label="Board pagination">
          <span>Showing {visibleBoards.length} of {filteredBoards.length} boards</span>
          {hasMoreBoards ? (
            <button className="product-button product-button-secondary" onClick={() => setVisibleLimit((value) => value + boardPageSize)} type="button">
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function createBoardId() {
  return `board-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}

function getBoardObjectTotal(board: BoardPersistenceSummary) {
  return board.shapeCount + board.assetCount
}

function getActivityTime(board: BoardPersistenceSummary) {
  return Date.parse(board.lastOpenedAt || board.savedAt) || 0
}

function getSavedTime(board: BoardPersistenceSummary) {
  return Date.parse(board.savedAt) || 0
}
